export const executionStatuses = [
  'idle',
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'timed-out',
] as const

export type ExecutionStatus = typeof executionStatuses[number] | (string & {})

export const stepStatuses = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'skipped',
  'cancelled',
] as const

export type StepStatus = typeof stepStatuses[number] | (string & {})

export const paymentStatuses = [
  'not-required',
  'pending',
  'authorized',
  'settled',
  'failed',
  'refunded',
] as const

export type PaymentStatus = typeof paymentStatuses[number] | (string & {})

export const connectionStatuses = [
  'idle',
  'connecting',
  'connected',
  'reconnecting',
  'closed',
  'error',
] as const

export type ExecutionConnectionStatus = typeof connectionStatuses[number]

export type ExecutionPanelState = 'loading' | 'empty' | 'error' | 'disabled' | 'ready'

/** Keep money as a decimal-safe string. Formatting never performs arithmetic. */
export interface ExecutionCost {
  amount: string
  currency?: string
  label?: string
}

export interface ExecutionError {
  message: string
  code?: string
  retryable?: boolean
}

export interface ExecutionStep {
  id: string
  label: string
  status: StepStatus
  description?: string
  startedAt?: string
  finishedAt?: string
  cost?: ExecutionCost
  error?: ExecutionError
}

export interface ExecutionPayment {
  status: PaymentStatus
  mode?: 'simulated' | 'x402'
  amount?: ExecutionCost
  reference?: string
  paymentIdentifier?: string
  error?: ExecutionError
}

/**
 * A contract-neutral event shape. Runtime/SSE adapters should map their payload
 * into this shape before passing it to the reducer.
 */
export interface ExecutionEvent<Payload = unknown> {
  id?: string
  sequence?: number
  type?: string
  timestamp?: string
  status?: ExecutionStatus
  step?: Partial<ExecutionStep> & Pick<ExecutionStep, 'id'>
  payment?: Partial<ExecutionPayment>
  cost?: ExecutionCost
  error?: ExecutionError
  payload?: Payload
}

export interface ExecutionEventCursor {
  lastEventId?: string
  lastSequence?: number
}

export interface ExecutionTimelineState<Payload = unknown> extends ExecutionEventCursor {
  status: ExecutionStatus
  connection: ExecutionConnectionStatus
  steps: readonly ExecutionStep[]
  payment?: ExecutionPayment
  cost?: ExecutionCost
  error?: ExecutionError
  events: readonly ExecutionEvent<Payload>[]
  /** IDs are retained so a reconnect cannot replay an already applied event. */
  seenEventIds: readonly string[]
}

export type ExecutionTimelineAction<Payload = unknown> =
  | { type: 'event'; event: ExecutionEvent<Payload> }
  | { type: 'snapshot'; events: readonly ExecutionEvent<Payload>[] }
  | { type: 'connection'; status: ExecutionConnectionStatus; error?: ExecutionError }
  | { type: 'reset'; state?: Partial<ExecutionTimelineState<Payload>> }

export function createExecutionTimelineState<Payload = unknown>(
  initial: Partial<ExecutionTimelineState<Payload>> = {},
): ExecutionTimelineState<Payload> {
  const events = initial.events ?? []
  const lastEvent = events[events.length - 1]
  const eventSequences = events
    .map((event) => event.sequence)
    .filter((sequence): sequence is number => sequence !== undefined)

  return {
    status: initial.status ?? 'idle',
    connection: initial.connection ?? 'idle',
    steps: initial.steps ?? [],
    payment: initial.payment,
    cost: initial.cost,
    error: initial.error,
    events,
    lastEventId: initial.lastEventId ?? lastEvent?.id,
    lastSequence: initial.lastSequence ?? (eventSequences.length > 0 ? Math.max(...eventSequences) : undefined),
    seenEventIds: initial.seenEventIds ?? events.flatMap((event) => event.id ? [event.id] : []),
  }
}

export function executionStatusLabel(status: string): string {
  const koreanLabels: Record<string, string> = {
    CREATED: '생성됨',
    PAYMENT_REQUIRED: '결제 필요',
    PAYMENT_SETTLED: '결제 완료',
    RUNNING: '실행 중',
    COMPLETED: '완료',
    FAILED: '실패',
    queued: '대기 중',
    running: '실행 중',
    succeeded: '완료',
    failed: '실패',
  }
  if (koreanLabels[status]) return koreanLabels[status]
  return status
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatExecutionCost(cost: ExecutionCost | undefined): string | undefined {
  if (!cost) return undefined
  if (cost.label) return cost.label
  return cost.currency ? `${cost.amount} ${cost.currency}` : cost.amount
}

export function formatExecutionError(error: ExecutionError | undefined): string | undefined {
  if (!error) return undefined
  return error.code ? `${error.code}: ${error.message}` : error.message
}

export function reconnectHeaders(cursor: ExecutionEventCursor): Record<string, string> {
  return cursor.lastEventId ? { 'Last-Event-ID': cursor.lastEventId } : {}
}
