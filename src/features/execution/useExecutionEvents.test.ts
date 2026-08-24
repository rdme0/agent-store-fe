import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { streamExecutionEvents } from '../../entities/execution/api'
import { runExecutionStreamLoop, useExecutionEvents } from './useExecutionEvents'
import type { ExecutionEvent } from './model'

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

  it('reconciles refreshed GET snapshots into the existing timeline', async () => {
    streamMock.mockImplementation(async (_id, options) => new Promise((resolve) => {
      options.signal.addEventListener('abort', () => resolve(), { once: true })
    }))
    const rootEvent: ExecutionEvent = {
      id: 'snapshot-root',
      sequence: -1,
      step: { id: 'root', label: 'investment', status: 'RUNNING' },
    }
    const { result, rerender, unmount } = renderHook(
      ({ initialEvents }) => useExecutionEvents({ executionId: 'execution-id', initialEvents }),
      { initialProps: { initialEvents: [rootEvent] } },
    )

    expect(result.current.steps.map((step) => step.id)).toEqual(['root'])
    rerender({
      initialEvents: [
        {
          ...rootEvent,
          sequence: -2,
          step: { id: 'root', label: 'investment', status: 'COMPLETED' },
        },
        { id: 'snapshot-child', sequence: -1, step: { id: 'financial', label: 'financial', status: 'COMPLETED' } },
      ],
    })

    await waitFor(() => expect(result.current.steps.map((step) => step.id)).toEqual(['root', 'financial']))
    unmount()
  })

  it('resets on execution identity change and ignores events from the previous stream', async () => {
    const sessions: Array<Parameters<typeof streamExecutionEvents>[1]> = []
    streamMock.mockImplementation(async (_id, options) => {
      sessions.push(options)
      await new Promise<void>((resolve) => {
        options.signal.addEventListener('abort', () => resolve(), { once: true })
      })
    })
    interface HookProps {
      executionId: string
      initialEvents: ExecutionEvent[]
    }
    const firstEvents: ExecutionEvent[] = [{
      id: 'first-root',
      sequence: -1,
      step: { id: 'first-root', label: 'first', status: 'RUNNING' },
    }]
    const secondEvents: ExecutionEvent[] = [{
      id: 'second-root',
      sequence: -1,
      step: { id: 'second-root', label: 'second', status: 'RUNNING' },
    }]
    const { result, rerender, unmount } = renderHook(
      ({ executionId, initialEvents }: HookProps) => useExecutionEvents({ executionId, initialEvents }),
      { initialProps: { executionId: 'first-execution', initialEvents: firstEvents } },
    )
    await waitFor(() => expect(sessions).toHaveLength(1))

    rerender({ executionId: 'second-execution', initialEvents: secondEvents })
    await waitFor(() => expect(sessions).toHaveLength(2))
    act(() => {
      sessions[0].onEvent({
        id: 'late-first-event',
        type: 'STEP_COMPLETED',
        payload: { stepId: 'first-root' },
      })
    })

    expect(result.current.steps.map((step) => step.id)).toEqual(['second-root'])
    unmount()
  })
})
