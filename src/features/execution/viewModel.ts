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
import { baseSepoliaExplorerUrl, paymentFailureMessage, paymentModeLabel } from './paymentPresentation'

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
  mode?: 'simulated' | 'x402'
  modeLabel?: string
  statusLabel: string
  statusTone: ExecutionStatusTone
  amountLabel?: string
  reference?: string
  transactionExplorerUrl?: string
  paymentIdentifier?: string
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
  const normalized = status.toLowerCase().replaceAll('_', '-')
  if (normalized === 'succeeded' || normalized === 'settled' || normalized === 'completed' || normalized === 'payment-settled') return 'success'
  if (normalized === 'failed' || normalized === 'cancelled' || normalized === 'timed-out') return 'danger'
  if (normalized === 'running' || normalized === 'connected' || normalized === 'authorized') return 'info'
  if (normalized === 'pending' || normalized === 'queued' || normalized === 'reconnecting' || normalized === 'payment-required') return 'warning'
  return 'neutral'
}

function connectionLabel(status: ExecutionConnectionStatus): string {
  switch (status) {
    case 'connected': return '실시간 업데이트 연결됨'
    case 'connecting': return '실시간 업데이트 연결 중'
    case 'reconnecting': return '실시간 업데이트 재연결 중'
    case 'closed': return '실시간 업데이트 종료됨'
    case 'error': return '실시간 연결을 복구하는 중'
    case 'idle': return '실시간 업데이트 대기 중'
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
    title: options.title ?? '실행 흐름',
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
      mode: timeline.payment.mode,
      modeLabel: timeline.payment.mode ? paymentModeLabel(timeline.payment.mode) : undefined,
      statusLabel: executionStatusLabel(timeline.payment.status),
      statusTone: statusTone(timeline.payment.status),
      amountLabel: formatExecutionCost(timeline.payment.amount),
      reference: timeline.payment.reference,
      transactionExplorerUrl: timeline.payment.mode === 'x402' ? baseSepoliaExplorerUrl(timeline.payment.reference) : undefined,
      paymentIdentifier: timeline.payment.paymentIdentifier,
      errorLabel: paymentFailureMessage(timeline.payment.error?.code) ?? formatExecutionError(timeline.payment.error),
    } : undefined,
    costLabel: formatExecutionCost(timeline.cost),
    errorLabel: options.errorMessage ?? paymentFailureMessage(timeline.error?.code) ?? executionError,
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
