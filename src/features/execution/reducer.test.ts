import { describe, expect, it } from 'vitest'
import {
  createExecutionTimelineState,
  reconnectHeaders,
  type ExecutionEvent,
} from './model'
import { applyExecutionEvents, executionTimelineReducer } from './reducer'

describe('execution timeline reducer', () => {
  it('applies ordered events and merges step/payment snapshots', () => {
    const events: ExecutionEvent[] = [
      {
        id: 'event-1',
        sequence: 1,
        status: 'running',
        step: { id: 'prepare', label: 'Prepare', status: 'running' },
      },
      {
        id: 'event-2',
        sequence: 2,
        step: { id: 'prepare', status: 'succeeded', finishedAt: '2026-08-17T00:01:00Z' },
        payment: { status: 'pending', amount: { amount: '1.25', currency: 'USDC' } },
        cost: { amount: '1.25', currency: 'USDC' },
      },
    ]

    const state = applyExecutionEvents(events)

    expect(state.status).toBe('running')
    expect(state.connection).toBe('idle')
    expect(state.steps).toEqual([{
      id: 'prepare',
      label: 'Prepare',
      status: 'succeeded',
      finishedAt: '2026-08-17T00:01:00Z',
    }])
    expect(state.payment?.status).toBe('pending')
    expect(state.cost).toEqual({ amount: '1.25', currency: 'USDC' })
    expect(state.lastEventId).toBe('event-2')
    expect(state.lastSequence).toBe(2)
  })

  it('ignores duplicate IDs and stale sequence values during reconnect replay', () => {
    const initial = applyExecutionEvents([
      { id: 'event-1', sequence: 1, status: 'queued' },
      { id: 'event-2', sequence: 2, status: 'running' },
    ])

    const duplicate = executionTimelineReducer(initial, {
      type: 'event',
      event: { id: 'event-2', sequence: 2, status: 'failed' },
    })
    const stale = executionTimelineReducer(initial, {
      type: 'event',
      event: { id: 'event-old', sequence: 1, status: 'failed' },
    })

    expect(duplicate).toBe(initial)
    expect(stale).toBe(initial)
    expect(initial.events).toHaveLength(2)
  })

  it('accepts ID-only streams and preserves the last cursor on events without IDs', () => {
    const initial = createExecutionTimelineState({ lastEventId: 'event-1' })
    const next = applyExecutionEvents([
      { id: 'event-2', status: 'running' },
      { status: 'succeeded' },
    ], initial)

    expect(next.lastEventId).toBe('event-2')
    expect(next.status).toBe('succeeded')
    expect(next.events).toHaveLength(2)
  })

  it('tracks a connection error without discarding the accumulated timeline', () => {
    const initial = applyExecutionEvents([{ id: 'event-1', sequence: 1, status: 'running' }])
    const next = executionTimelineReducer(initial, {
      type: 'connection',
      status: 'error',
      error: { code: 'STREAM_LOST', message: 'Connection lost', retryable: true },
    })

    expect(next.connection).toBe('error')
    expect(next.error).toEqual({ code: 'STREAM_LOST', message: 'Connection lost', retryable: true })
    expect(next.events).toHaveLength(1)
    expect(next.lastEventId).toBe('event-1')
  })
})

describe('execution stream reconnect cursor', () => {
  it('sets Last-Event-ID only when a cursor is available', () => {
    expect(reconnectHeaders({})).toEqual({})
    expect(reconnectHeaders({ lastEventId: 'event-17' })).toEqual({ 'Last-Event-ID': 'event-17' })
  })
})
