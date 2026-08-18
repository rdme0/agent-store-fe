import { describe, expect, it } from 'vitest'
import { executionSnapshotEvents, isTerminalExecutionEvent, toTimelineEvent } from './eventAdapter'
import type { ExecutionDto } from '../../entities/execution/api'

const execution: ExecutionDto = {
  id: 'execution-id', quoteId: 'quote-id', status: 'RUNNING', maxBudgetAtomic: '3000000',
  reservedCostAtomic: '1000000', actualCostAtomic: '500000', question: '분석해줘',
  steps: [{
    id: 'root-step', agentVersionId: 'root-version', status: 'PAYMENT_SETTLED', costAtomic: '500000',
    payments: [], createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:01Z',
  }],
  createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:01Z',
}

describe('execution event adapter', () => {
  it('maps execution snapshots without converting atomic amounts to numbers', () => {
    const events = executionSnapshotEvents(execution, () => 'investment')

    expect(events[0].step).toMatchObject({
      id: 'root-step', label: 'investment', status: 'PAYMENT_SETTLED',
      cost: { amount: '500000', label: '0.5 USDC' },
    })
    expect(events.at(-1)).toMatchObject({ status: 'running' })
  })

  it('maps SSE metadata and typed payload fields into timeline updates', () => {
    expect(toTimelineEvent({
      id: '12', type: 'PAYMENT_SETTLED',
      payload: { stepId: 'child-step', amountAtomic: '1250000', transactionHash: '0xtx' },
    })).toMatchObject({
      id: '12', sequence: 12,
      step: { id: 'child-step', status: 'PAYMENT_SETTLED', cost: { amount: '1250000' } },
      payment: { status: 'settled', reference: '0xtx' },
    })
  })

  it('recognizes every backend terminal event', () => {
    expect(isTerminalExecutionEvent('EXECUTION_COMPLETED')).toBe(true)
    expect(isTerminalExecutionEvent('EXECUTION_FAILED')).toBe(true)
    expect(isTerminalExecutionEvent('EXECUTION_RECONCILIATION_REQUIRED')).toBe(true)
    expect(isTerminalExecutionEvent('STEP_FAILED')).toBe(false)
  })
})
