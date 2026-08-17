import {
  createExecutionTimelineState,
  type ExecutionEvent,
  type ExecutionTimelineAction,
  type ExecutionTimelineState,
  type ExecutionStep,
} from './model'

function hasNewerSequence(
  state: ExecutionTimelineState,
  event: ExecutionEvent,
): boolean {
  if (event.sequence === undefined || state.lastSequence === undefined) return true
  return event.sequence > state.lastSequence
}

function hasAlreadySeen(state: ExecutionTimelineState, event: ExecutionEvent): boolean {
  return event.id !== undefined && state.seenEventIds.includes(event.id)
}

function mergeStep(
  steps: readonly ExecutionStep[],
  incoming: NonNullable<ExecutionEvent['step']>,
): readonly ExecutionStep[] {
  const index = steps.findIndex((step) => step.id === incoming.id)
  if (index === -1) {
    if (!incoming.label || !incoming.status) return steps
    return [...steps, incoming as ExecutionStep]
  }

  const next = [...steps]
  next[index] = { ...next[index], ...incoming }
  return next
}

function mergePayment(
  current: ExecutionTimelineState['payment'],
  incoming: NonNullable<ExecutionEvent['payment']>,
): ExecutionTimelineState['payment'] {
  if (current) return { ...current, ...incoming }
  if (!incoming.status) return current
  return incoming as NonNullable<ExecutionTimelineState['payment']>
}

function reduceEvent<Payload>(
  state: ExecutionTimelineState<Payload>,
  event: ExecutionEvent<Payload>,
): ExecutionTimelineState<Payload> {
  // Numeric sequence is authoritative when present. IDs provide deduplication
  // for reconnects and for streams that do not expose numeric sequence values.
  if (hasAlreadySeen(state, event) || !hasNewerSequence(state, event)) return state

  const seenEventIds = event.id
    ? [...state.seenEventIds, event.id]
    : state.seenEventIds
  const nextSequence = event.sequence === undefined
    ? state.lastSequence
    : Math.max(state.lastSequence ?? event.sequence, event.sequence)

  return {
    ...state,
    status: event.status ?? state.status,
    steps: event.step ? mergeStep(state.steps, event.step) : state.steps,
    payment: event.payment ? mergePayment(state.payment, event.payment) : state.payment,
    cost: event.cost ?? state.cost,
    error: event.error ?? state.error,
    connection: state.connection,
    events: [...state.events, event],
    lastEventId: event.id ?? state.lastEventId,
    lastSequence: nextSequence,
    seenEventIds,
  }
}

export function executionTimelineReducer<Payload = unknown>(
  state: ExecutionTimelineState<Payload>,
  action: ExecutionTimelineAction<Payload>,
): ExecutionTimelineState<Payload> {
  switch (action.type) {
    case 'event':
      return reduceEvent(state, action.event)
    case 'connection':
      return {
        ...state,
        connection: action.status,
        error: action.error ?? (action.status === 'error' ? state.error : undefined),
      }
    case 'reset':
      return createExecutionTimelineState(action.state)
  }
}

export function applyExecutionEvents<Payload = unknown>(
  events: readonly ExecutionEvent<Payload>[],
  initial: Partial<ExecutionTimelineState<Payload>> = {},
): ExecutionTimelineState<Payload> {
  return events.reduce(
    (state, event) => executionTimelineReducer(state, { type: 'event', event }),
    createExecutionTimelineState(initial),
  )
}
