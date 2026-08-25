import { fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { QuoteSnapshot } from '../../entities/dependency/model'
import type { ExecutionDto } from '../../entities/execution/api'
import { createExecutionTimelineState } from './model'
import { ExecutionJourney } from './ExecutionJourney'
import { buildExecutionJourney } from './journeyModel'

const snapshot: QuoteSnapshot = {
  version: {
    id: 'root-version',
    agentId: 'root-agent',
    agentCode: 'investment',
    agentName: '투자 분석',
    agentDescription: '여러 전문 분석을 모아 이해하기 쉬운 답변을 만들어요.',
    semver: '1.2.0',
    endpoint: 'http://localhost:8090/agents/investment/invoke',
    priceAtomic: '1000',
    network: 'eip155:84532',
    asset: 'USDC',
    payTo: '0x0000000000000000000000000000000000000001',
    responseFormat: 'MARKDOWN',
  },
  dependencies: [{
    dependencyId: 'news-dependency',
    targetAgentId: 'news-agent',
    targetAgentCode: 'news',
    versionConstraint: '*',
    required: true,
    maxPriceAtomic: '1000',
    maxCalls: 2,
    resolved: {
      version: {
        id: 'news-version',
        agentId: 'news-agent',
        agentCode: 'news',
        agentName: '최근 뉴스 확인',
        agentDescription: '시장과 관련된 최신 기사를 살펴봐요.',
        semver: '1.0.0',
        endpoint: 'http://localhost:8091/agents/news/invoke',
        priceAtomic: '500',
        network: 'eip155:84532',
        asset: 'USDC',
        payTo: '0x0000000000000000000000000000000000000002',
        responseFormat: 'JSON',
      },
      dependencies: [{
        dependencyId: 'optional-dependency',
        versionConstraint: '*',
        required: false,
        maxPriceAtomic: '1000',
        maxCalls: 1,
      }],
    },
  }],
}

const originalMatchMedia = window.matchMedia

function execution(overrides: Partial<ExecutionDto> = {}): ExecutionDto {
  return {
    id: 'execution-id',
    quoteId: 'quote-id',
    quoteSnapshot: snapshot,
    status: 'RUNNING',
    maxBudgetAtomic: '3000',
    reservedCostAtomic: '1000',
    actualCostAtomic: '0',
    steps: [],
    createdAt: '2026-08-23T00:00:00Z',
    updatedAt: '2026-08-23T00:00:00Z',
    ...overrides,
  }
}

const rootStep: ExecutionDto['steps'][number] = {
  id: 'root-step',
  agentVersionId: 'root-version',
  agentCode: 'investment',
  agentName: '투자 분석',
  status: 'RUNNING',
  costAtomic: '1000',
  responseFormat: 'MARKDOWN',
  payments: [],
  createdAt: '2026-08-23T00:00:00Z',
  updatedAt: '2026-08-23T00:00:00Z',
}

afterEach(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
})

describe('ExecutionJourney', () => {
  it('keeps the snapshot tree planned without inventing progress', () => {
    const model = buildExecutionJourney(snapshot, execution(), createExecutionTimelineState())

    expect(model.totalCount).toBe(3)
    expect(model.completedCount).toBe(0)
    expect(model.roots[0].status).toBe('planned')
    expect(model.roots[0].children[0].status).toBe('planned')
    expect(model.roots[0].children[0].agentDescription).toBe('시장과 관련된 최신 기사를 살펴봐요.')
  })

  it('animates only the current analysis path while queued cards stay still', () => {
    const preparingRoot: ExecutionDto['steps'][number] = { ...rootStep, status: 'CREATED' }
    const preparingNews: ExecutionDto['steps'][number] = {
      ...rootStep,
      id: 'news-step',
      parentStepId: 'root-step',
      agentVersionId: 'news-version',
      agentCode: 'news',
      agentName: '최근 뉴스 확인',
      status: 'CREATED',
      responseFormat: 'JSON',
    }
    const preparingExecution = execution({ steps: [preparingRoot, preparingNews] })
    const model = buildExecutionJourney(
      snapshot,
      preparingExecution,
      createExecutionTimelineState(),
    )

    expect(model.activePathIds).toEqual([
      model.roots[0].id,
      model.roots[0].children[0].id,
    ])

    const { container } = render(
      <ExecutionJourney
        execution={preparingExecution}
        mode="easy"
        snapshot={snapshot}
        timeline={createExecutionTimelineState()}
      />,
    )

    expect(container.querySelectorAll('.execution-journey__item--loading')).toHaveLength(2)
    expect(container.querySelectorAll('.execution-journey__item--preparing')).toHaveLength(2)
    expect(container.querySelectorAll('.execution-journey__spinner')).toHaveLength(2)
  })

  it('never animates a completed check icon', () => {
    const { container } = render(
      <ExecutionJourney
        execution={execution({ status: 'COMPLETED', steps: [{ ...rootStep, status: 'COMPLETED' }] })}
        mode="easy"
        snapshot={snapshot}
        timeline={createExecutionTimelineState({ status: 'succeeded' })}
      />,
    )

    expect(container.querySelectorAll('.execution-journey__item--completed')).toHaveLength(1)
    expect(container.querySelectorAll('.execution-journey__spinner')).toHaveLength(0)
  })

  it('groups repeated dependency calls and sums atomic cost exactly', () => {
    const newsSteps: ExecutionDto['steps'] = [7, 11].map((costAtomic, index) => ({
      ...rootStep,
      id: `news-step-${index}`,
      parentStepId: 'root-step',
      agentVersionId: 'news-version',
      agentCode: 'news',
      agentName: '최근 뉴스 확인',
      status: 'COMPLETED',
      costAtomic: costAtomic.toString(),
      responseFormat: 'JSON',
    }))
    const model = buildExecutionJourney(
      snapshot,
      execution({ status: 'COMPLETED', steps: [{ ...rootStep, status: 'COMPLETED' }, ...newsSteps] }),
      createExecutionTimelineState({ status: 'succeeded' }),
    )
    const news = model.roots[0].children[0]

    expect(news.callCount).toBe(2)
    expect(news.completedCallCount).toBe(2)
    expect(news.costAtomic).toBe('18')
    expect(news.status).toBe('completed')
    expect(news.children[0].status).toBe('not-used')
  })

  it('marks an uncreated dependency unused as soon as its parent is complete', () => {
    const model = buildExecutionJourney(
      snapshot,
      execution({ steps: [{ ...rootStep, status: 'COMPLETED' }] }),
      createExecutionTimelineState(),
    )

    expect(model.terminal).toBe(false)
    expect(model.roots[0].children[0].status).toBe('not-used')
  })

  it('keeps reconciliation separate from success and failure', () => {
    const model = buildExecutionJourney(
      snapshot,
      execution({
        status: 'FAILED',
        steps: [{
          ...rootStep,
          status: 'FAILED',
          payments: [{
            id: 'payment-id',
            status: 'RECONCILIATION_REQUIRED',
            amountAtomic: '1000',
            mode: 'x402',
          }],
        }],
      }),
      createExecutionTimelineState({ status: 'failed' }),
    )

    expect(model.roots[0].status).toBe('reconciliation')
    expect(model.roots[0].hasConfirmedCost).toBe(false)
  })

  it('shows only costs confirmed by settlement or a completed step', () => {
    const paidFailure = buildExecutionJourney(
      snapshot,
      execution({
        status: 'FAILED',
        steps: [{
          ...rootStep,
          status: 'FAILED',
          costAtomic: '0',
          payments: [{ id: 'settled', status: 'SETTLED', amountAtomic: '999', mode: 'x402' }],
        }],
      }),
      createExecutionTimelineState({ status: 'failed' }),
    )
    const awaitingPayment = buildExecutionJourney(
      snapshot,
      execution({
        steps: [{
          ...rootStep,
          status: 'PAYMENT_REQUIRED',
          costAtomic: '0',
          payments: [{ id: 'required', status: 'REQUIRED', amountAtomic: '1000', mode: 'x402' }],
        }],
      }),
      createExecutionTimelineState(),
    )

    expect(paidFailure.roots[0].costAtomic).toBe('999')
    expect(paidFailure.roots[0].hasConfirmedCost).toBe(true)
    expect(awaitingPayment.roots[0].costAtomic).toBe('0')
    expect(awaitingPayment.roots[0].hasConfirmedCost).toBe(false)
  })

  it('announces each actual transition once without moving focus', async () => {
    const timeline = createExecutionTimelineState({
      status: 'running',
      steps: [{ id: 'root-step', label: '투자 분석', status: 'RUNNING' }],
    })
    const activeExecution = execution({ steps: [rootStep] })
    const { container, rerender } = render(
      <ExecutionJourney
        execution={activeExecution}
        mode="easy"
        snapshot={snapshot}
        timeline={timeline}
      />,
    )

    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).not.toBeNull()
    await waitFor(() => expect(liveRegion).toHaveTextContent('투자 분석 단계를 시작했어요.'))
    expect(container.querySelectorAll('[aria-live]').length).toBe(1)
    expect(container.querySelector('[role="status"]')).toBeNull()

    const focusTarget = document.createElement('button')
    document.body.append(focusTarget)
    focusTarget.focus()
    let mutationCount = 0
    const observer = new MutationObserver((records) => { mutationCount += records.length })
    observer.observe(liveRegion as Node, { childList: true, characterData: true, subtree: true })

    rerender(
      <ExecutionJourney
        execution={activeExecution}
        mode="easy"
        snapshot={snapshot}
        timeline={timeline}
      />,
    )
    await Promise.resolve()
    expect(mutationCount).toBe(0)

    rerender(
      <ExecutionJourney
        execution={execution({ status: 'COMPLETED', steps: [{ ...rootStep, status: 'COMPLETED' }] })}
        mode="easy"
        snapshot={snapshot}
        timeline={createExecutionTimelineState({ status: 'succeeded' })}
      />,
    )
    await waitFor(() => expect(liveRegion).toHaveTextContent('투자 분석 확인을 마쳤어요.'))
    await waitFor(() => expect(mutationCount).toBeGreaterThan(0))
    expect(focusTarget).toHaveFocus()
    observer.disconnect()
    focusTarget.remove()
  })

  it('announces failure and reconciliation transitions through the same live region', async () => {
    const failedExecution = execution({ status: 'FAILED', steps: [{ ...rootStep, status: 'FAILED' }] })
    const { container, rerender } = render(
      <ExecutionJourney
        execution={failedExecution}
        mode="easy"
        snapshot={snapshot}
        timeline={createExecutionTimelineState({ status: 'failed' })}
      />,
    )
    const liveRegion = container.querySelector('[aria-live="polite"]')

    await waitFor(() => expect(liveRegion).toHaveTextContent('투자 분석 단계에 문제가 생겼어요.'))
    rerender(
      <ExecutionJourney
        execution={execution({
          status: 'FAILED',
          steps: [{
            ...rootStep,
            status: 'FAILED',
            payments: [{
              id: 'reconciliation',
              status: 'RECONCILIATION_REQUIRED',
              amountAtomic: '1000',
              mode: 'x402',
            }],
          }],
        })}
        mode="easy"
        snapshot={snapshot}
        timeline={createExecutionTimelineState({ status: 'failed' })}
      />,
    )

    await waitFor(() => expect(liveRegion).toHaveTextContent('투자 분석 단계의 결제를 확인하고 있어요.'))
    expect(container.querySelectorAll('[aria-live]').length).toBe(1)
  })

  it('starts a fresh announcement lifecycle when the execution identity changes', async () => {
    const timeline = createExecutionTimelineState({
      status: 'running',
      steps: [{ id: 'root-step', label: '투자 분석', status: 'RUNNING' }],
    })
    const firstExecution = execution({ steps: [rootStep] })
    const { container, rerender } = render(
      <ExecutionJourney execution={firstExecution} mode="easy" snapshot={snapshot} timeline={timeline} />,
    )
    const liveRegion = container.querySelector('[aria-live="polite"]')
    await waitFor(() => expect(liveRegion).toHaveTextContent('투자 분석 단계를 시작했어요.'))
    let mutationCount = 0
    const observer = new MutationObserver((records) => { mutationCount += records.length })
    observer.observe(liveRegion as Node, { childList: true, characterData: true, subtree: true })

    rerender(
      <ExecutionJourney
        execution={{ ...firstExecution, id: 'next-execution-id' }}
        mode="easy"
        snapshot={snapshot}
        timeline={timeline}
      />,
    )

    await waitFor(() => expect(liveRegion).toHaveTextContent('투자 분석 단계를 시작했어요.'))
    await waitFor(() => expect(mutationCount).toBeGreaterThan(0))
    expect(container.querySelectorAll('[aria-live]').length).toBe(1)
    observer.disconnect()
  })

  it('pauses motion while the tab is hidden', () => {
    const timeline = createExecutionTimelineState({
      status: 'running',
      steps: [{ id: 'root-step', label: '투자 분석', status: 'RUNNING' }],
    })
    const { container } = render(
      <ExecutionJourney execution={execution({ steps: [rootStep] })} mode="easy" snapshot={snapshot} timeline={timeline} />,
    )

    expect(container.querySelector('.execution-journey')).not.toHaveClass('execution-journey--paused')

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    fireEvent(document, new Event('visibilitychange'))

    expect(container.querySelector('.execution-journey')).toHaveClass('execution-journey--paused')
  })

  it('disables journey animation when reduced motion is requested', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
    const { container } = render(
      <ExecutionJourney
        execution={execution({ steps: [rootStep] })}
        mode="easy"
        snapshot={snapshot}
        timeline={createExecutionTimelineState({
          status: 'running',
          steps: [{ id: 'root-step', label: '투자 분석', status: 'RUNNING' }],
        })}
      />,
    )

    expect(container.querySelector('.execution-journey')).toHaveClass('execution-journey--paused')
  })
})
