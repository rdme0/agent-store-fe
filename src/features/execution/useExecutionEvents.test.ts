import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { streamExecutionEvents } from '../../entities/execution/api'
import { runExecutionStreamLoop, useExecutionEvents } from './useExecutionEvents'

vi.mock('../../entities/execution/api', () => ({ streamExecutionEvents: vi.fn() }))

const streamMock = vi.mocked(streamExecutionEvents)

beforeEach(() => vi.resetAllMocks())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('execution SSE loop', () => {
  it('reconnects with Last-Event-ID and stops on the latest terminal event in a replay', async () => {
    streamMock
      .mockImplementationOnce(async (_id, options) => {
        options.onEvent({ id: '1', type: 'EXECUTION_RUNNING', payload: {} })
        options.onEvent({ id: '2', type: 'STEP_RUNNING', payload: { stepId: 'root' } })
      })
      .mockImplementationOnce(async (_id, options) => {
        expect(options.afterEventId).toBe('2')
        options.onEvent({ id: '2', type: 'STEP_RUNNING', payload: { stepId: 'root' } })
        options.onEvent({ id: '3', type: 'EXECUTION_RECONCILIATION_REQUIRED', payload: { terminal: true } })
        options.onEvent({ id: '4', type: 'EXECUTION_FAILED', payload: { terminal: true, failureCode: 'FAILED_AFTER_PAYMENT' } })
      })
    const received: string[] = []
    const connections: string[] = []

    await runExecutionStreamLoop('execution-id', {
      signal: new AbortController().signal,
      sleep: async () => undefined,
      onConnection: (status) => connections.push(status),
      onEvent: (event) => received.push(`${event.id}:${event.type}`),
    })

    expect(streamMock).toHaveBeenCalledTimes(2)
    expect(received).toEqual([
      '1:EXECUTION_RUNNING', '2:STEP_RUNNING', '2:STEP_RUNNING',
      '3:EXECUTION_RECONCILIATION_REQUIRED', '4:EXECUTION_FAILED',
    ])
    expect(connections).toContain('reconnecting')
    expect(connections.at(-1)).toBe('closed')
  })

  it('clears reconnect backoff immediately when the consumer unmounts', async () => {
    vi.useFakeTimers()
    streamMock.mockResolvedValue(undefined)
    function Harness() {
      useExecutionEvents({ executionId: 'execution-id', initialEvents: [] })
      return null
    }

    const view = render(createElement(Harness))
    await act(async () => { await Promise.resolve() })
    expect(streamMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)

    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
    await act(async () => { await vi.runAllTimersAsync() })
    expect(streamMock).toHaveBeenCalledTimes(1)
  })
})
