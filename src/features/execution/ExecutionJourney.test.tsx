import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ExecutionDto } from '../../entities/execution/api'
import { ExecutionJourney } from './ExecutionJourney'
import { buildExecutionJourney } from './journeyModel'

const execution: ExecutionDto = {
  id: 'execution-1', quoteId: 'quote-1', createdAt: '2026-08-27T00:00:00Z', updatedAt: '2026-08-27T00:00:00Z', status: 'RUNNING', actualCostAtomic: '0', maxBudgetAtomic: '1000000', reservedCostAtomic: '1000000', steps: [{ id: 'root-step', agentVersionId: 'root-version', agentCode: 'root', agentName: 'Root 분석', costAtomic: '0', createdAt: '2026-08-27T00:00:00Z', updatedAt: '2026-08-27T00:00:00Z', status: 'RUNNING', payments: [] }],
}

describe('ExecutionJourney', () => {
  it('derives the journey solely from the persisted execution and quote snapshot', () => {
    const model = buildExecutionJourney(undefined, execution)
    expect(model.roots[0]?.status).toBe('active')
    render(<ExecutionJourney displayMode="easy" execution={execution} />)
    expect(screen.getByText('Root 분석')).toBeInTheDocument()
    expect(screen.getByText('확인 중')).toBeInTheDocument()
  })
})
