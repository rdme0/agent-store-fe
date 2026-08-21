import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../shared/config/env', () => ({ DEMO_DEVELOPER_ID: 'developer-id' }))
vi.mock('../entities/revenue/api', () => ({ getDeveloperRevenue: vi.fn() }))

import { getDeveloperRevenue } from '../entities/revenue/api'
import { DeveloperDashboardPage } from './DeveloperDashboardPage'

const getRevenueMock = vi.mocked(getDeveloperRevenue)
const firstPage = {
  developerId: 'developer-id', totalRevenueAtomic: '3000000', directRevenueAtomic: '1000000', dependencyRevenueAtomic: '2000000', directCount: 1, dependencyCount: 2,
  entries: [{ id: 'entry-1', executionStepId: 'step-1', paymentAttemptId: 'payment-1', type: 'DIRECT' as const, amountAtomic: '1000000', paymentMode: 'x402' as const, transactionHash: `0x${'a'.repeat(64)}`, paymentIdentifier: 'safe-payment-id', createdAt: '2026-08-18T00:00:00Z' }],
  nextCursor: 'cursor-2',
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter><DeveloperDashboardPage /></MemoryRouter></QueryClientProvider>)
}

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('DeveloperDashboardPage', () => {
  it('renders totals, payment entries, and loads the next cursor page', async () => {
    getRevenueMock.mockResolvedValueOnce(firstPage).mockResolvedValueOnce({ ...firstPage, entries: [{ ...firstPage.entries[0], id: 'entry-2', type: 'DEPENDENCY' as const, paymentMode: 'simulated' as const, transactionHash: undefined }], nextCursor: undefined })
    renderPage()
    expect(await screen.findByText('3 USDC')).toBeInTheDocument()
    expect(screen.getAllByText('직접 호출')).not.toHaveLength(0)
    expect(screen.getByRole('link', { name: 'Base Sepolia 보기' })).toHaveAttribute('href', `https://sepolia.basescan.org/tx/${'0x'}${'a'.repeat(64)}`)
    fireEvent.click(screen.getByRole('button', { name: '더 불러오기' }))
    expect(await screen.findByText('의존성 호출')).toBeInTheDocument()
    expect(getRevenueMock).toHaveBeenLastCalledWith('developer-id', { cursor: 'cursor-2', limit: 20 })
  })

  it('offers retry after an API error', async () => {
    getRevenueMock.mockRejectedValueOnce(new Error('수익 조회 오류')).mockResolvedValueOnce({ ...firstPage, nextCursor: undefined })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('수익 조회 오류')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('정산 내역')).toBeInTheDocument()
  })
})
