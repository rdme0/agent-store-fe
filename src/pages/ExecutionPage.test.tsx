import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getExecution, streamExecutionEvents } from '../entities/execution/api'
import { ExecutionPage } from './ExecutionPage'

vi.mock('../entities/execution/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../entities/execution/api')>()
  return { ...actual, getExecution: vi.fn(), streamExecutionEvents: vi.fn() }
})

const getExecutionMock = vi.mocked(getExecution)
const streamMock = vi.mocked(streamExecutionEvents)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([
    { path: '/runs/:id', element: <ExecutionPage /> },
    { path: '/agents', element: <p>Marketplace</p> },
  ], {
    initialEntries: [{
      pathname: '/runs/execution-id',
      state: {
        quoteSnapshot: {
          version: {
            id: 'root-version', agentId: 'root-agent', agentSlug: 'investment', semver: '1.0.0',
            endpoint: 'http://localhost:8090/investment', priceAtomic: '1000000', network: 'eip155:84532',
            asset: 'USDC', payTo: '0x0000000000000000000000000000000000000001',
          },
          dependencies: [],
        },
      },
    }],
  })
  render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>)
}

beforeEach(() => {
  vi.resetAllMocks()
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
          id: 'payment-id', status: 'SETTLED', amountAtomic: '1000000', mode: 'x402',
          transactionHash: `0x${'a'.repeat(64)}`, paymentIdentifier: 'receipt-id',
        }], createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
      }], createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
    })
    renderPage()

    expect(await screen.findByRole('heading', { name: '실행 상세' })).toBeInTheDocument()
    expect(screen.getByText('시장 위험은?')).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'investment: 완료' })).toBeInTheDocument()
    expect(screen.getByText(/분산 투자가 필요합니다/)).toBeInTheDocument()
    expect(screen.getAllByText('1 USDC').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3 USDC')).toHaveLength(2)
    expect(screen.getByText('x402 실제 결제 (Base Sepolia)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Base Sepolia/ })).toHaveAttribute('href', `https://sepolia.basescan.org/tx/${'0x'}${'a'.repeat(64)}`)
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
})
