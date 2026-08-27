import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getExecution, streamExecutionEvents } from '../entities/execution/api'
import { DisplayModeProvider } from '../app/DisplayModeContext'
import { ExecutionPage } from './ExecutionPage'

vi.mock('../entities/execution/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../entities/execution/api')>()
  return { ...actual, getExecution: vi.fn(), streamExecutionEvents: vi.fn() }
})

const getExecutionMock = vi.mocked(getExecution)
const streamMock = vi.mocked(streamExecutionEvents)

function mockViewport(narrow: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: narrow,
      media: '(max-width: 700px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function renderPage(withLocationSnapshot = true, displayMode: 'easy' | 'developer' = 'developer') {
  window.localStorage.setItem('agentstore.display-mode', displayMode)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([
    { path: '/runs/:id', element: <ExecutionPage /> },
    { path: '/agents', element: <p>Marketplace</p> },
  ], {
    initialEntries: [{
      pathname: '/runs/execution-id',
      state: withLocationSnapshot ? {
        quoteSnapshot: {
          version: {
            id: 'root-version', agentId: 'root-agent', agentCode: 'investment', semver: '1.0.0',
            endpoint: 'http://localhost:8090/investment', priceAtomic: '1000000', network: 'eip155:84532',
            asset: 'USDC', payTo: '0x0000000000000000000000000000000000000001',
          },
          dependencies: [],
        },
      } : undefined,
    }],
  })
  render(<QueryClientProvider client={queryClient}><DisplayModeProvider><RouterProvider router={router} /></DisplayModeProvider></QueryClientProvider>)
}

beforeEach(() => {
  vi.resetAllMocks()
  mockViewport(false)
  streamMock.mockImplementation(async (_id, options) => {
    options.onEvent({ id: '1', type: 'EXECUTION_COMPLETED', payload: { terminal: true } })
  })
})

afterEach(() => cleanup())

describe('ExecutionPage', () => {
  it('renders step state, exact costs, question, and final output from GET details', async () => {
    getExecutionMock.mockResolvedValue({
      id: 'execution-id', quoteId: 'quote-id', status: 'COMPLETED', maxBudgetAtomic: '3000000',
      reservedCostAtomic: '0', actualCostAtomic: '1000000', question: '시장 위험은?',
      steps: [{
        id: 'root-step', agentVersionId: 'root-version', status: 'COMPLETED', costAtomic: '1000000',
        output: { answer: '분산 투자가 필요합니다.' }, payments: [{
          id: 'payment-id', status: 'SETTLED', amountAtomic: '1000000',
          transactionHash: `0x${'a'.repeat(64)}`, paymentIdentifier: 'receipt-id',
        }], createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
      }], createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
    })
    renderPage()

    expect(await screen.findByRole('heading', { name: '실행 상세' })).toBeInTheDocument()
    expect(screen.getByText('시장 위험은?')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: '분석 단계: 확인 완료' })).toBeInTheDocument()
    expect(screen.getByText(/분산 투자가 필요합니다/)).toBeInTheDocument()
    expect(screen.getAllByText('1 USDC').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3 USDC').length).toBeGreaterThanOrEqual(2)
  })

  it('renders an API error with a retry action', async () => {
    getExecutionMock.mockRejectedValue(new Error('실행 조회 오류'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('실행 조회 오류')
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled()
  })

  it('selects the renderer from the execution step response format', async () => {
    getExecutionMock.mockResolvedValue({
      id: 'execution-id', quoteId: 'quote-id', status: 'COMPLETED', maxBudgetAtomic: '1000000',
      reservedCostAtomic: '0', actualCostAtomic: '1000000',
      steps: [{
        id: 'root-step', agentVersionId: 'root-version', status: 'COMPLETED', costAtomic: '1000000', responseFormat: 'STRUCTURED',
        output: { title: '결과 요약', sections: [{ label: '상태', value: '완료' }] }, payments: [],
        createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
      }], createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
    })
    renderPage()

    expect(await screen.findByRole('heading', { name: '결과 요약' })).toBeInTheDocument()
    expect(screen.getAllByText('완료').length).toBeGreaterThan(0)
  })

  it('adds dependency steps and edges after the terminal event refreshes execution details', async () => {
    const baseExecution = {
      id: 'execution-id', quoteId: 'quote-id', maxBudgetAtomic: '2000', reservedCostAtomic: '0',
      question: '삼성전자 투자 분석해줘', createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
    }
    const rootStep = {
      id: 'root-step', agentVersionId: 'root-version', costAtomic: '1000', payments: [],
      createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
    }
    getExecutionMock
      .mockResolvedValueOnce({
        ...baseExecution,
        status: 'RUNNING',
        actualCostAtomic: '1000',
        steps: [{ ...rootStep, status: 'RUNNING' }],
      })
      .mockResolvedValue({
        ...baseExecution,
        status: 'COMPLETED',
        actualCostAtomic: '2000',
        steps: [
          { ...rootStep, status: 'COMPLETED', output: { recommendation: '분석 완료' } },
          {
            id: 'financial-step', parentStepId: 'root-step', agentVersionId: 'financial-version',
            status: 'COMPLETED', costAtomic: '1000', output: { revenueGrowth: 12 }, payments: [],
            createdAt: '2026-08-17T00:00:01Z', updatedAt: '2026-08-17T00:00:02Z',
          },
        ],
      })
    renderPage()

    expect(await screen.findByText('노드 2개 · 연결 1개')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '분석 단계 · COMPLETED 의존성' })).toHaveTextContent('runtime call')
  })

  it('restores the quoted graph and provider selection proof from the execution response', async () => {
    getExecutionMock.mockResolvedValue({
      id: 'execution-id', quoteId: 'quote-id', status: 'COMPLETED', maxBudgetAtomic: '2000',
      reservedCostAtomic: '0', actualCostAtomic: '1000', steps: [],
      quoteSnapshot: {
        version: {
          id: 'root-version', agentId: 'root-agent', agentCode: 'investment', agentName: '투자 분석', semver: '1.0.0',
          agentDescription: '시장·뉴스·위험 분석을 모아 최종 답변을 만들어요.',
          endpoint: 'http://localhost:8090/investment', priceAtomic: '1000', network: 'eip155:84532',
          asset: 'USDC', payTo: '0x0000000000000000000000000000000000000001', responseFormat: 'MARKDOWN',
        },
        dependencies: [{
          dependencyId: 'dependency-id', versionConstraint: '*', required: true,
          maxPriceAtomic: '1000', maxCalls: 1,
          selection: {
            strategy: 'lowest_price', providerScope: 'marketplace', functionContractId: 'function-contract-id', functionCode: 'news-analysis',
            functionContractVersion: '1.0.0', selectedVersionId: 'news-version', selectedReason: 'selected_by_lowest_price',
            candidates: [{ agentId: 'news-agent', agentCode: 'news-fast', versionId: 'news-version', semver: '1.0.0', priceAtomic: '500', status: 'selected' }],
          },
          resolved: {
            version: {
              id: 'news-version', agentId: 'news-agent', agentCode: 'news-fast', agentName: '빠른 뉴스', semver: '1.0.0',
              agentDescription: '시장과 관련된 최신 기사를 살펴봐요.',
              endpoint: 'http://localhost:8091/news-fast', priceAtomic: '500', network: 'eip155:84532',
              asset: 'USDC', payTo: '0x0000000000000000000000000000000000000002', responseFormat: 'JSON',
            },
            dependencies: [],
          },
        }],
      },
      createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
    })

    renderPage(false)

    expect(await screen.findByRole('heading', { name: 'Quote에 고정된 거래 그래프' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '공급자 선택 증명' })).toBeInTheDocument()
    expect(screen.getByText('selected_by_lowest_price')).toBeInTheDocument()
    expect(screen.getAllByText('빠른 뉴스').length).toBeGreaterThan(0)
    expect(screen.getByText('시장과 관련된 최신 기사를 살펴봐요.')).toBeInTheDocument()
    expect(screen.getByText('이번 답변에는 사용되지 않았어요')).toBeInTheDocument()
  })

  it('does not expose provider selection wallet or transaction proof in easy mode', async () => {
    const payTo = '0x0000000000000000000000000000000000000002'
    const transactionHash = `0x${'b'.repeat(64)}`
    getExecutionMock.mockResolvedValue({
      id: 'execution-id', quoteId: 'quote-id', status: 'COMPLETED', maxBudgetAtomic: '1000',
      reservedCostAtomic: '0', actualCostAtomic: '1000', question: '쉽게 설명해줘',
      steps: [{
        id: 'root-step', agentVersionId: 'root-version', status: 'COMPLETED', costAtomic: '1000',
        responseFormat: 'MARKDOWN', output: '# 쉬운 답변', payments: [{
          id: 'payment-id', status: 'SETTLED', amountAtomic: '1000', transactionHash,
        }], createdAt: '', updatedAt: '',
      }],
      quoteSnapshot: {
        version: {
          id: 'root-version', agentId: 'root-agent', agentCode: 'investment', semver: '1.0.0',
          endpoint: 'http://localhost:8090/investment', priceAtomic: '1000', network: 'eip155:84532',
          asset: 'USDC', payTo, responseFormat: 'MARKDOWN',
        },
        dependencies: [],
      },
      createdAt: '', updatedAt: '',
    })

    renderPage(false, 'easy')

    expect(await screen.findByRole('heading', { name: '답변을 정리했어요' })).toBeInTheDocument()
    expect(screen.queryByText('공급자 선택 증명')).not.toBeInTheDocument()
    expect(screen.queryByText(payTo)).not.toBeInTheDocument()
    expect(screen.queryByText(transactionHash)).not.toBeInTheDocument()
  })

  it('separates an unknown payment outcome from ordinary failure in easy mode', async () => {
    getExecutionMock.mockResolvedValue({
      id: 'execution-id', quoteId: 'quote-id', status: 'FAILED', maxBudgetAtomic: '1000',
      reservedCostAtomic: '1000', actualCostAtomic: '1000', question: '분석해줘',
      steps: [{
        id: 'root-step', agentVersionId: 'root-version', status: 'FAILED', costAtomic: '1000',
        responseFormat: 'MARKDOWN', payments: [{
          id: 'payment-id', status: 'RECONCILIATION_REQUIRED', amountAtomic: '1000',
        }], createdAt: '', updatedAt: '',
      }],
      quoteSnapshot: {
        version: {
          id: 'root-version', agentId: 'root-agent', agentCode: 'investment', agentName: '투자 분석',
          agentDescription: '여러 분석을 모아 답변을 만들어요.', semver: '1.0.0',
          endpoint: 'http://localhost:8090/investment', priceAtomic: '1000', network: 'eip155:84532',
          asset: 'USDC', payTo: '0x0000000000000000000000000000000000000001', responseFormat: 'MARKDOWN',
        },
        dependencies: [],
      },
      createdAt: '', updatedAt: '',
    })

    renderPage(false, 'easy')

    expect(await screen.findByRole('heading', { name: '결제를 확인하고 있어요' })).toBeInTheDocument()
    expect(screen.getByText(/결제 확인 중이라 결과를 확정하지 못했어요/)).toBeInTheDocument()
    expect(screen.getByRole('article', { name: '투자 분석: 결제 확인 중' })).toBeInTheDocument()
  })

  it('does not render technical graphs on a narrow viewport', async () => {
    mockViewport(true)
    getExecutionMock.mockResolvedValue({
      id: 'execution-id', quoteId: 'quote-id', status: 'RUNNING', maxBudgetAtomic: '1000',
      reservedCostAtomic: '1000', actualCostAtomic: '0', steps: [],
      quoteSnapshot: {
        version: {
          id: 'root-version', agentId: 'root-agent', agentCode: 'investment', semver: '1.0.0',
          endpoint: 'http://localhost:8090/investment', priceAtomic: '1000', network: 'eip155:84532',
          asset: 'USDC', payTo: '0x0000000000000000000000000000000000000001', responseFormat: 'MARKDOWN',
        },
        dependencies: [],
      },
      createdAt: '', updatedAt: '',
    })

    renderPage(false, 'developer')

    expect(await screen.findByRole('heading', { name: '질문이 답변이 되기까지' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Quote에 고정된 거래 그래프' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '실시간 의존성 그래프' })).not.toBeInTheDocument()
    expect(screen.getByText(/모바일에서는 거래 그래프 대신/)).toBeInTheDocument()
  })
})
