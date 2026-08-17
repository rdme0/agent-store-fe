import {
  executionStatusLabel,
  formatExecutionCost,
  formatExecutionError,
  type ExecutionPanelState,
  type ExecutionTimelineState,
  type ExecutionConnectionStatus,
  type ExecutionStatus,
  type StepStatus,
  type PaymentStatus,
} from './model'

export type ExecutionStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface ExecutionStatusViewModel {
  value: string
  label: string
  tone: ExecutionStatusTone
}

export interface ExecutionTimelineStepViewModel {
  id: string
  label: string
  status: string
  statusLabel: string
  statusTone: ExecutionStatusTone
  description?: string
  startedAt?: string
  finishedAt?: string
  costLabel?: string
  errorLabel?: string
}

export interface ExecutionPaymentViewModel {
  status: string
  statusLabel: string
  statusTone: ExecutionStatusTone
  amountLabel?: string
  reference?: string
  errorLabel?: string
}

export interface ExecutionTimelineViewModel {
  panelState: ExecutionPanelState
  title: string
  executionStatus: ExecutionStatusViewModel
  connection: {
    value: ExecutionConnectionStatus
    label: string
  }
  steps: readonly ExecutionTimelineStepViewModel[]
  payment?: ExecutionPaymentViewModel
  costLabel?: string
  errorLabel?: string
  errorRetryable?: boolean
  panelMessage?: string
  eventCount: number
}

export interface ExecutionTimelineViewModelOptions {
  panelState?: ExecutionPanelState
  title?: string
  errorMessage?: string
  disabledMessage?: string
}

function statusTone(status: string): ExecutionStatusTone {
  if (status === 'succeeded' || status === 'settled') return 'success'
  if (status === 'failed' || status === 'cancelled' || status === 'timed-out') return 'danger'
  if (status === 'running' || status === 'connected' || status === 'authorized') return 'info'
  if (status === 'pending' || status === 'queued' || status === 'reconnecting') return 'warning'
  return 'neutral'
}

function connectionLabel(status: ExecutionConnectionStatus): string {
  switch (status) {
    case 'connected': return 'Live updates connected'
    case 'connecting': return 'Connecting to live updates'
    case 'reconnecting': return 'Reconnecting to live updates'
    case 'closed': return 'Live updates closed'
    case 'error': return 'Live updates unavailable'
    case 'idle': return 'Live updates not started'
  }
}

export function createExecutionTimelineViewModel<Payload = unknown>(
  timeline: ExecutionTimelineState<Payload>,
  options: ExecutionTimelineViewModelOptions = {},
): ExecutionTimelineViewModel {
  const hasTimelineData = timeline.steps.length > 0
    || timeline.events.length > 0
    || timeline.payment !== undefined
    || timeline.cost !== undefined
    || timeline.error !== undefined
  const panelState = options.panelState ?? (hasTimelineData ? 'ready' : 'empty')
  const executionError = formatExecutionError(timeline.error)

  return {
    panelState,
    title: options.title ?? 'Execution timeline',
    executionStatus: {
      value: timeline.status,
      label: executionStatusLabel(timeline.status),
      tone: statusTone(timeline.status),
    },
    connection: {
      value: timeline.connection,
      label: connectionLabel(timeline.connection),
    },
    steps: timeline.steps.map((step) => ({
      id: step.id,
      label: step.label,
      status: step.status,
      statusLabel: executionStatusLabel(step.status),
      statusTone: statusTone(step.status),
      description: step.description,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
      costLabel: formatExecutionCost(step.cost),
      errorLabel: formatExecutionError(step.error),
    })),
    payment: timeline.payment ? {
      status: timeline.payment.status,
      statusLabel: executionStatusLabel(timeline.payment.status),
      statusTone: statusTone(timeline.payment.status),
      amountLabel: formatExecutionCost(timeline.payment.amount),
      reference: timeline.payment.reference,
      errorLabel: formatExecutionError(timeline.payment.error),
    } : undefined,
    costLabel: formatExecutionCost(timeline.cost),
    errorLabel: options.errorMessage ?? executionError,
    errorRetryable: timeline.error?.retryable,
    panelMessage: panelState === 'disabled'
      ? options.disabledMessage
      : panelState === 'error'
        ? options.errorMessage ?? executionError
        : undefined,
    eventCount: timeline.events.length,
  }
}

export function statusClassName(status: string, tone: ExecutionStatusTone): string {
  const safeStatus = status.toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  return `execution-timeline__status execution-timeline__status--${tone} execution-timeline__status--${safeStatus}`
}

export type { ExecutionStatus, StepStatus, PaymentStatus }
