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

  it('does not regress a terminal step when earlier payment events are replayed', () => {
    const completed = applyExecutionEvents([{
      id: 'snapshot-step',
      sequence: 0,
      step: { id: 'step', label: '뉴스 확인', status: 'COMPLETED' },
    }])

    const replayed = executionTimelineReducer(completed, {
      type: 'event',
      event: { id: 'payment-replay', sequence: 3, step: { id: 'step', status: 'PAYMENT_SETTLED' } },
    })
    const staleRefresh = executionTimelineReducer(replayed, {
      type: 'snapshot',
      events: [{
        id: 'snapshot-step-running',
        sequence: 0,
        step: { id: 'step', label: '뉴스 확인', status: 'RUNNING' },
      }],
    })

    expect(replayed.steps[0].status).toBe('COMPLETED')
    expect(staleRefresh.steps[0].status).toBe('COMPLETED')
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

  it('merges refreshed execution steps without duplicating them or discarding stream state', () => {
    const initial = applyExecutionEvents([
      { id: 'snapshot-root', sequence: -1, step: { id: 'root', label: 'investment', status: 'RUNNING' } },
      { id: 'stream-terminal', sequence: 7, status: 'succeeded' },
    ], { connection: 'closed' })

    const next = executionTimelineReducer(initial, {
      type: 'snapshot',
      events: [
        { id: 'snapshot-root', sequence: -2, step: { id: 'root', label: 'investment', status: 'COMPLETED' } },
        { id: 'snapshot-child', sequence: -1, step: { id: 'financial', label: 'financial', status: 'COMPLETED' } },
        { id: 'snapshot-execution', sequence: 0, status: 'running' },
      ],
    })

    expect(next.steps.map((step) => step.id)).toEqual(['root', 'financial'])
    expect(next.steps[0].status).toBe('COMPLETED')
    expect(next.status).toBe('succeeded')
    expect(next.connection).toBe('closed')
    expect(next.lastEventId).toBe('stream-terminal')
    expect(next.lastSequence).toBe(7)

    const repeated = executionTimelineReducer(next, {
      type: 'snapshot',
      events: [
        { id: 'snapshot-root', sequence: -2, step: { id: 'root', label: 'investment', status: 'COMPLETED' } },
        { id: 'snapshot-child', sequence: -1, step: { id: 'financial', label: 'financial', status: 'COMPLETED' } },
        { id: 'snapshot-execution', sequence: 0, status: 'running' },
      ],
    })
    expect(repeated).toBe(next)
  })
})

describe('execution stream reconnect cursor', () => {
  it('sets Last-Event-ID only when a cursor is available', () => {
    expect(reconnectHeaders({})).toEqual({})
    expect(reconnectHeaders({ lastEventId: 'event-17' })).toEqual({ 'Last-Event-ID': 'event-17' })
  })
})
