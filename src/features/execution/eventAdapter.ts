import { formatAtomicUsdc } from '../../entities/agent/model'
import type { ExecutionDto, ExecutionStreamEvent } from '../../entities/execution/api'
import type { ExecutionEvent, ExecutionStep } from './model'

interface EventPayload {
  amountAtomic?: unknown
  agentVersionId?: unknown
  failureCode?: unknown
  output?: unknown
  stepId?: unknown
  transactionHash?: unknown
  paymentIdentifier?: unknown
  paymentMode?: unknown
}

export type StepLabelResolver = (agentVersionId: string) => string

function payloadOf(value: unknown): EventPayload {
  return typeof value === 'object' && value !== null ? value as EventPayload : {}
}

function executionStatus(status: ExecutionDto['status']): string {
  if (status === 'PENDING') return 'queued'
  if (status === 'COMPLETED') return 'succeeded'
  if (status === 'FAILED') return 'failed'
  return 'running'
}

export function executionSnapshotEvents(
  execution: ExecutionDto,
  labelForVersion: StepLabelResolver,
): ExecutionEvent[] {
  const stepEvents: ExecutionEvent[] = execution.steps.flatMap((step, index) => {
    const stepEvent: ExecutionEvent = {
      id: `snapshot-${step.id}`,
      sequence: -(execution.steps.length - index),
      step: {
        id: step.id,
        label: labelForVersion(step.agentVersionId),
        status: step.status,
        description: step.parentStepId ? 'Dependency Agent 호출' : 'Root Agent 호출',
        startedAt: step.createdAt,
        finishedAt: step.status === 'COMPLETED' || step.status === 'FAILED' ? step.updatedAt : undefined,
        cost: { amount: step.costAtomic, label: formatAtomicUsdc(step.costAtomic) },
        error: step.failureCode ? { code: step.failureCode, message: '실행 단계가 실패했습니다.' } : undefined,
      },
    }
    const payment = step.payments.at(-1)
    if (!payment) return [stepEvent]
    return [{
      ...stepEvent,
      payment: {
        status: payment.status === 'SETTLED' ? 'settled' : payment.status === 'FAILED' ? 'failed' : 'pending',
        mode: payment.mode,
        amount: { amount: payment.amountAtomic, label: formatAtomicUsdc(payment.amountAtomic) },
        reference: payment.transactionHash,
        paymentIdentifier: payment.paymentIdentifier,
        error: payment.failureCode ? { code: payment.failureCode, message: '결제 처리에 실패했습니다.' } : undefined,
      },
    }]
  })
  return [...stepEvents, {
    id: 'snapshot-execution',
    sequence: 0,
    status: executionStatus(execution.status),
    error: execution.failureCode ? { code: execution.failureCode, message: '실행이 실패했습니다.' } : undefined,
  }]
}

function stepPatch(type: string | undefined, payload: EventPayload): ExecutionEvent['step'] {
  if (typeof payload.stepId !== 'string') return undefined
  const statusByType: Record<string, ExecutionStep['status']> = {
    PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
    PAYMENT_SETTLED: 'PAYMENT_SETTLED',
    STEP_RUNNING: 'RUNNING',
    STEP_COMPLETED: 'COMPLETED',
    STEP_FAILED: 'FAILED',
    PAYMENT_RECONCILIATION_REQUIRED: 'FAILED',
  }
  const status = type ? statusByType[type] : undefined
  if (!status) return undefined

  return {
    id: payload.stepId,
    status,
    cost: typeof payload.amountAtomic === 'string'
      ? { amount: payload.amountAtomic, label: formatAtomicUsdc(payload.amountAtomic) }
      : undefined,
    error: typeof payload.failureCode === 'string'
      ? { code: payload.failureCode, message: '실행 단계가 실패했습니다.' }
      : undefined,
  }
}

export function toTimelineEvent(event: ExecutionStreamEvent, labelForVersion?: StepLabelResolver): ExecutionEvent {
  const payload = payloadOf(event.payload)
  const sequence = event.id && /^\d+$/.test(event.id) ? Number(event.id) : undefined
  const statusByType: Record<string, string> = {
    EXECUTION_CREATED: 'queued',
    EXECUTION_RUNNING: 'running',
    EXECUTION_COMPLETED: 'succeeded',
    EXECUTION_FAILED: 'failed',
    EXECUTION_RECONCILIATION_REQUIRED: 'failed',
  }
  const amount = typeof payload.amountAtomic === 'string'
    ? { amount: payload.amountAtomic, label: formatAtomicUsdc(payload.amountAtomic) }
    : undefined
  return {
    id: event.id,
    sequence,
    type: event.type,
    status: event.type ? statusByType[event.type] : undefined,
    step: (() => {
      const patch = stepPatch(event.type, payload)
      if (!patch) return undefined
      return typeof payload.agentVersionId === 'string' && labelForVersion
        ? { ...patch, label: labelForVersion(payload.agentVersionId) }
        : patch
    })(),
    payment: event.type === 'PAYMENT_REQUIRED'
      ? { status: 'pending', amount }
      : event.type === 'PAYMENT_SETTLED'
        ? {
            status: 'settled',
            mode: payload.paymentMode === 'x402' ? 'x402' : payload.paymentMode === 'simulated' ? 'simulated' : undefined,
            amount,
            reference: typeof payload.transactionHash === 'string' ? payload.transactionHash : undefined,
            paymentIdentifier: typeof payload.paymentIdentifier === 'string' ? payload.paymentIdentifier : undefined,
          }
        : event.type === 'PAYMENT_RECONCILIATION_REQUIRED'
          ? { status: 'failed', error: { code: 'PAYMENT_RECONCILIATION_REQUIRED', message: '결제 확인이 필요합니다.' } }
          : undefined,
    error: typeof payload.failureCode === 'string'
      ? { code: payload.failureCode, message: '실행이 실패했습니다.' }
      : undefined,
    payload: event.payload,
  }
}

export function isTerminalExecutionEvent(type: string | undefined): boolean {
  return type === 'EXECUTION_COMPLETED'
    || type === 'EXECUTION_FAILED'
    || type === 'EXECUTION_RECONCILIATION_REQUIRED'
}
