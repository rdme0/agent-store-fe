import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { streamExecutionEvents } from '../../entities/execution/api'
import { runExecutionStreamLoop, useExecutionEvents } from './useExecutionEvents'

vi.mock('../../entities/execution/api', () => ({ streamExecutionEvents: vi.fn() }))
const streamMock = vi.mocked(streamExecutionEvents)

beforeEach(() => vi.resetAllMocks())
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('execution SSE lifecycle', () => {
  it('reconnects from its cursor and closes after a terminal event', async () => {
    streamMock.mockImplementationOnce(async (_id, options) => { options.onEvent({ id: '1', type: 'EXECUTION_RUNNING', payload: {} }) }).mockImplementationOnce(async (_id, options) => { expect(options.afterEventId).toBe('1'); options.onEvent({ id: '2', type: 'EXECUTION_COMPLETED', payload: {} }) })
    const states: string[] = []
    await runExecutionStreamLoop('execution-id', { signal: new AbortController().signal, sleep: async () => undefined, onConnection: (status) => states.push(status), onEvent: () => undefined })
    expect(states.at(-1)).toBe('closed')
  })

  it('deduplicates replayed events and serializes server snapshot refetches', async () => {
    const sessions: Array<Parameters<typeof streamExecutionEvents>[1]> = []
    streamMock.mockImplementation(async (_id, options) => { sessions.push(options); await new Promise<void>((resolve) => options.signal.addEventListener('abort', () => resolve(), { once: true })) })
    let release!: () => void
    const refetch = vi.fn(() => new Promise<void>((resolve) => { release = resolve }))
    const { unmount } = renderHook(() => useExecutionEvents({ executionId: 'execution-1', refetch, terminal: false }))
    await waitFor(() => expect(sessions).toHaveLength(1))
    act(() => { sessions[0].onEvent({ id: 'replayed', type: 'STEP_RUNNING', payload: {} }); sessions[0].onEvent({ id: 'replayed', type: 'STEP_RUNNING', payload: {} }); sessions[0].onEvent({ id: 'next', type: 'STEP_RUNNING', payload: {} }) })
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1))
    await act(async () => { release(); await Promise.resolve() })
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(2))
    unmount()
  })

  it('aborts the replaced route stream and ignores its late event', async () => {
    const sessions: Array<Parameters<typeof streamExecutionEvents>[1]> = []
    streamMock.mockImplementation(async (_id, options) => { sessions.push(options); await new Promise<void>((resolve) => options.signal.addEventListener('abort', () => resolve(), { once: true })) })
    const refetch = vi.fn().mockResolvedValue(undefined)
    const { rerender, unmount } = renderHook(({ executionId }) => useExecutionEvents({ executionId, refetch, terminal: false }), { initialProps: { executionId: 'first' } })
    await waitFor(() => expect(sessions).toHaveLength(1))
    rerender({ executionId: 'second' })
    await waitFor(() => expect(sessions).toHaveLength(2))
    act(() => sessions[0].onEvent({ id: 'late', type: 'STEP_COMPLETED', payload: {} }))
    expect(refetch).not.toHaveBeenCalled()
    unmount()
  })

  it('does not open a stream for a terminal snapshot', async () => {
    function Harness() { useExecutionEvents({ executionId: 'execution-id', refetch: vi.fn(), terminal: true }); return null }
    render(createElement(Harness))
    expect(streamMock).not.toHaveBeenCalled()
  })
})
