import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { AgentVersionModel } from '../../entities/agent/model'
import { createAgentQuote } from '../../entities/dependency/api'
import type { QuoteModel } from '../../entities/dependency/model'
import { QuotePanel } from './QuotePanel'
import { createExecution } from '../../entities/execution/api'
import { ApiRequestError } from '../../shared/api/client'

vi.mock('../../entities/dependency/api', () => ({ createAgentQuote: vi.fn() }))
vi.mock('../../entities/execution/api', () => ({ createExecution: vi.fn() }))

const createAgentQuoteMock = vi.mocked(createAgentQuote)
const createExecutionMock = vi.mocked(createExecution)
const version: AgentVersionModel = {
  id: 'version-id', agentId: 'investment-id', semver: '1.0.0', status: 'ACTIVE', endpoint: 'http://localhost:8090',
  priceAtomic: '1000000', priceLabel: '1 USDC', network: 'eip155:84532', asset: 'USDC', payTo: '0x1', createdAt: '', updatedAt: '',
}
const quote: QuoteModel = {
  id: 'quote-id', rootVersionId: version.id, expiresAt: '2099-01-01T00:05:00.000Z', maxCostAtomic: '2500000', maxCostLabel: '2.5 USDC',
  snapshot: {
    version: { id: version.id, agentId: version.agentId, agentSlug: 'investment', semver: version.semver, endpoint: version.endpoint, priceAtomic: version.priceAtomic, network: version.network, asset: version.asset, payTo: version.payTo },
    dependencies: [{ dependencyId: 'dependency-id', targetAgentId: 'risk-id', targetAgentSlug: 'risk', versionConstraint: '^1.0.0', required: false, maxPriceAtomic: '1500000', maxCalls: 1 }],
  },
  warnings: [{ code: 'OPTIONAL_DEPENDENCY_NOT_RESOLVED', dependencyId: 'dependency-id', targetAgentId: 'risk-id', targetAgentSlug: 'risk', versionConstraint: '^1.0.0' }],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

afterEach(() => cleanup())
beforeEach(() => vi.resetAllMocks())

describe('QuotePanel', () => {
  it('blocks an expired quote locally and guides the user to issue a new one', async () => {
    createAgentQuoteMock.mockResolvedValue({ ...quote, expiresAt: '2020-01-01T00:00:00.000Z' })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><MemoryRouter><QuotePanel slug="investment" version={version} /></MemoryRouter></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Quote가 만료되었습니다')
    expect(screen.getByRole('button', { name: 'Maximum Cost 승인 후 실행' })).toBeDisabled()
  })

  it('turns a structured expired-quote response into an actionable message', async () => {
    const refreshedQuote = { ...quote, id: 'quote-refreshed' }
    createAgentQuoteMock.mockResolvedValueOnce(quote).mockResolvedValueOnce(refreshedQuote)
    createExecutionMock.mockRejectedValue(new ApiRequestError('Execution quote has expired', 409, { code: 'QUOTE_EXPIRED' }))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><MemoryRouter><QuotePanel slug="investment" version={version} /></MemoryRouter></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
    const executeButton = await screen.findByRole('button', { name: 'Maximum Cost 승인 후 실행' })
    fireEvent.change(screen.getByLabelText('Agent에게 물어볼 질문'), { target: { value: '시장 위험은?' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(executeButton)
    expect(await screen.findByRole('alert')).toHaveTextContent('Quote가 만료되었습니다')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(executeButton).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Quote 새로 발급' }))
    expect(await screen.findByText('quote-refreshed')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('issues a typed quote and renders maximum cost, warning, and graph', async () => {
    createAgentQuoteMock.mockResolvedValue(quote)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><MemoryRouter><QuotePanel slug="investment" version={version} /></MemoryRouter></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
    expect((await screen.findAllByText('2.5 USDC')).length).toBeGreaterThan(0)
    expect(screen.getByRole('note')).toHaveTextContent('risk')
    expect(screen.getByRole('heading', { name: 'Quoted dependency graph' })).toBeInTheDocument()
    expect(createAgentQuoteMock).toHaveBeenCalledWith('investment', { versionConstraint: '1.0.0' })
  })

  it('submits the exact quoted maximum budget only after question and approval', async () => {
    createAgentQuoteMock.mockResolvedValue(quote)
    createExecutionMock.mockResolvedValue({
      id: 'execution-id', quoteId: quote.id, status: 'PENDING', maxBudgetAtomic: quote.maxCostAtomic,
      reservedCostAtomic: '0', actualCostAtomic: '0', question: '시장 위험은?', steps: [], createdAt: '', updatedAt: '',
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><MemoryRouter><QuotePanel slug="investment" version={version} /></MemoryRouter></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
    await screen.findByText(/Maximum Cost를 확인한 뒤/i)
    const executeButton = await screen.findByRole('button', { name: 'Maximum Cost 승인 후 실행' })
    expect(executeButton).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Agent에게 물어볼 질문'), { target: { value: ' 시장 위험은? ' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(executeButton)

    await waitFor(() => expect(createExecutionMock).toHaveBeenCalledWith({
      quoteId: 'quote-id',
      maxBudgetAtomic: '2500000',
      question: '시장 위험은?',
    }))
  })

  it('blocks quote refresh while create is pending', async () => {
    createAgentQuoteMock.mockResolvedValue(quote)
    createExecutionMock.mockReturnValue(new Promise(() => undefined))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><MemoryRouter><QuotePanel slug="investment" version={version} /></MemoryRouter></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
    const executeButton = await screen.findByRole('button', { name: 'Maximum Cost 승인 후 실행' })
    fireEvent.change(screen.getByLabelText('Agent에게 물어볼 질문'), { target: { value: '시장 위험은?' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(executeButton)

    expect(await screen.findByRole('button', { name: '실행을 시작하는 중…' })).toBeDisabled()
    const refreshButton = screen.getByRole('button', { name: 'Quote 새로 발급' })
    expect(refreshButton).toBeDisabled()
    fireEvent.click(refreshButton)
    expect(createAgentQuoteMock).toHaveBeenCalledTimes(1)
  })

  it('clears a stale create error when quote reissue starts and accepts the new quote', async () => {
    const nextQuote = { ...quote, id: 'quote-new', maxCostAtomic: '3500000', maxCostLabel: '3.5 USDC' }
    createAgentQuoteMock.mockResolvedValueOnce(quote).mockResolvedValueOnce(nextQuote)
    createExecutionMock.mockRejectedValueOnce(new Error('이전 실행 오류'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><MemoryRouter><QuotePanel slug="investment" version={version} /></MemoryRouter></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
    const executeButton = await screen.findByRole('button', { name: 'Maximum Cost 승인 후 실행' })
    fireEvent.change(screen.getByLabelText('Agent에게 물어볼 질문'), { target: { value: '시장 위험은?' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(executeButton)
    expect(await screen.findByRole('alert')).toHaveTextContent('이전 실행 오류')

    fireEvent.click(screen.getByRole('button', { name: 'Quote 새로 발급' }))
    expect(screen.queryByText('이전 실행 오류')).not.toBeInTheDocument()
    expect(await screen.findByText('quote-new')).toBeInTheDocument()
    expect(screen.getAllByText('3.5 USDC').length).toBeGreaterThan(0)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('disables approval and rejects direct submit while quote reissue is pending', async () => {
    const pendingQuote = deferred<QuoteModel>()
    createAgentQuoteMock.mockResolvedValueOnce(quote).mockReturnValueOnce(pendingQuote.promise)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><MemoryRouter><QuotePanel slug="investment" version={version} /></MemoryRouter></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
    const executeButton = await screen.findByRole('button', { name: 'Maximum Cost 승인 후 실행' })
    fireEvent.change(screen.getByLabelText('Agent에게 물어볼 질문'), { target: { value: '시장 위험은?' } })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(executeButton).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Quote 새로 발급' }))
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(executeButton).toBeDisabled()
    fireEvent.submit(executeButton.closest('form')!)
    expect(createExecutionMock).not.toHaveBeenCalled()
    expect(createAgentQuoteMock).toHaveBeenCalledTimes(2)

    await act(async () => pendingQuote.resolve({ ...quote, id: 'quote-new' }))
    expect(await screen.findByText('quote-new')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('routes error retry through the same reset and in-flight guards', async () => {
    const retryQuote = deferred<QuoteModel>()
    createAgentQuoteMock
      .mockResolvedValueOnce(quote)
      .mockRejectedValueOnce(new Error('Quote 갱신 오류'))
      .mockReturnValueOnce(retryQuote.promise)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><MemoryRouter><QuotePanel slug="investment" version={version} /></MemoryRouter></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
    const executeButton = await screen.findByRole('button', { name: 'Maximum Cost 승인 후 실행' })
    fireEvent.change(screen.getByLabelText('Agent에게 물어볼 질문'), { target: { value: '시장 위험은?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Quote 새로 발급' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Quote 갱신 오류')
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('checkbox')).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(executeButton).toBeDisabled()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDisabled()
    fireEvent.submit(executeButton.closest('form')!)
    expect(createExecutionMock).not.toHaveBeenCalled()
    expect(createAgentQuoteMock).toHaveBeenCalledTimes(3)

    await act(async () => retryQuote.resolve({ ...quote, id: 'quote-retried' }))
    expect(await screen.findByText('quote-retried')).toBeInTheDocument()
  })

  it('atomically rejects same-tick duplicate quote requests', () => {
    createAgentQuoteMock.mockReturnValue(new Promise(() => undefined))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><MemoryRouter><QuotePanel slug="investment" version={version} /></MemoryRouter></QueryClientProvider>)

    const quoteButton = screen.getByRole('button', { name: 'Quote 발급' })
    fireEvent.click(quoteButton)
    fireEvent.click(quoteButton)

    expect(createAgentQuoteMock).toHaveBeenCalledTimes(1)
  })

  it('atomically rejects same-tick duplicate execution submits', async () => {
    createAgentQuoteMock.mockResolvedValue(quote)
    createExecutionMock.mockReturnValue(new Promise(() => undefined))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><MemoryRouter><QuotePanel slug="investment" version={version} /></MemoryRouter></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
    const executeButton = await screen.findByRole('button', { name: 'Maximum Cost 승인 후 실행' })
    fireEvent.change(screen.getByLabelText('Agent에게 물어볼 질문'), { target: { value: '시장 위험은?' } })
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(executeButton).toBeEnabled())
    const form = executeButton.closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)

    await waitFor(() => expect(createExecutionMock).toHaveBeenCalledTimes(1))
  })

  it('blocks a same-tick quote request after submit without suppressing valid navigation', async () => {
    const execution = deferred<Awaited<ReturnType<typeof createExecution>>>()
    createAgentQuoteMock.mockResolvedValue(quote)
    createExecutionMock.mockReturnValue(execution.promise)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/agents/investment']}>
          <Routes>
            <Route path="/agents/:slug" element={<QuotePanel slug="investment" version={version} />} />
            <Route path="/runs/:id" element={<p>실행 화면으로 이동됨</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
    const executeButton = await screen.findByRole('button', { name: 'Maximum Cost 승인 후 실행' })
    fireEvent.change(screen.getByLabelText('Agent에게 물어볼 질문'), { target: { value: '시장 위험은?' } })
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(executeButton).toBeEnabled())
    const quoteButton = screen.getByRole('button', { name: 'Quote 새로 발급' })
    fireEvent.submit(executeButton.closest('form')!)
    fireEvent.click(quoteButton)

    await waitFor(() => expect(createExecutionMock).toHaveBeenCalledTimes(1))
    expect(createAgentQuoteMock).toHaveBeenCalledTimes(1)
    await act(async () => execution.resolve({
      id: 'execution-id', quoteId: quote.id, status: 'PENDING', maxBudgetAtomic: quote.maxCostAtomic,
      reservedCostAtomic: '0', actualCostAtomic: '0', steps: [], createdAt: '', updatedAt: '',
    }))
    expect(await screen.findByText('실행 화면으로 이동됨')).toBeInTheDocument()
  })

  it('does not let an old request release a new lifecycle lock', async () => {
    const oldRequest = deferred<QuoteModel>()
    const newRequest = deferred<QuoteModel>()
    createAgentQuoteMock.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const view = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><QuotePanel slug="investment" version={version} /></MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
    const nextVersion = { ...version, id: 'version-new' }
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><QuotePanel slug="investment" version={nextVersion} /></MemoryRouter>
      </QueryClientProvider>,
    )
    const newQuoteButton = screen.getByRole('button', { name: 'Quote 발급' })
    fireEvent.click(newQuoteButton)
    expect(createAgentQuoteMock).toHaveBeenCalledTimes(2)

    await act(async () => oldRequest.resolve(quote))
    expect(newQuoteButton).toBeDisabled()
    newQuoteButton.removeAttribute('disabled')
    fireEvent.click(newQuoteButton)
    expect(createAgentQuoteMock).toHaveBeenCalledTimes(2)

    await act(async () => newRequest.resolve({ ...quote, id: 'quote-new-lifecycle' }))
    expect(await screen.findByText('quote-new-lifecycle')).toBeInTheDocument()
  })

  it('does not navigate when an execution resolves after its identity unmounts', async () => {
    const oldExecution = deferred<Awaited<ReturnType<typeof createExecution>>>()
    createAgentQuoteMock.mockResolvedValue(quote)
    createExecutionMock.mockReturnValue(oldExecution.promise)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const renderTree = (currentVersion: AgentVersionModel) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/agents/investment']}>
          <Routes>
            <Route path="/agents/:slug" element={<QuotePanel slug="investment" version={currentVersion} />} />
            <Route path="/runs/:id" element={<p>실행 화면으로 이동됨</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
    const view = render(renderTree(version))

    fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
    const executeButton = await screen.findByRole('button', { name: 'Maximum Cost 승인 후 실행' })
    fireEvent.change(screen.getByLabelText('Agent에게 물어볼 질문'), { target: { value: '시장 위험은?' } })
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(executeButton).toBeEnabled())
    fireEvent.submit(executeButton.closest('form')!)
    await waitFor(() => expect(createExecutionMock).toHaveBeenCalledTimes(1))

    view.rerender(renderTree({ ...version, id: 'version-new' }))
    expect(screen.getByRole('button', { name: 'Quote 발급' })).toBeEnabled()
    await act(async () => oldExecution.resolve({
      id: 'old-execution', quoteId: quote.id, status: 'PENDING', maxBudgetAtomic: quote.maxCostAtomic,
      reservedCostAtomic: '0', actualCostAtomic: '0', steps: [], createdAt: '', updatedAt: '',
    }))

    expect(screen.queryByText('실행 화면으로 이동됨')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quote 발급' })).toBeEnabled()
  })
})
