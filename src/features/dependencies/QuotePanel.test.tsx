import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentVersionModel } from '../../entities/agent/model'
import { createAgentQuote } from '../../entities/dependency/api'
import type { QuoteModel } from '../../entities/dependency/model'
import { QuotePanel } from './QuotePanel'

vi.mock('../../entities/dependency/api', () => ({ createAgentQuote: vi.fn() }))

const createAgentQuoteMock = vi.mocked(createAgentQuote)
const version: AgentVersionModel = {
  id: 'version-id', agentId: 'investment-id', semver: '1.0.0', status: 'ACTIVE', endpoint: 'http://localhost:8090',
  priceAtomic: '1000000', priceLabel: '1 USDC', network: 'eip155:84532', asset: 'USDC', payTo: '0x1', createdAt: '', updatedAt: '',
}
const quote: QuoteModel = {
  id: 'quote-id', rootVersionId: version.id, expiresAt: '2026-01-01T00:05:00.000Z', maxCostAtomic: '2500000', maxCostLabel: '2.5 USDC',
  snapshot: {
    version: { id: version.id, agentId: version.agentId, agentSlug: 'investment', semver: version.semver, endpoint: version.endpoint, priceAtomic: version.priceAtomic, network: version.network, asset: version.asset, payTo: version.payTo },
    dependencies: [{ dependencyId: 'dependency-id', targetAgentId: 'risk-id', targetAgentSlug: 'risk', versionConstraint: '^1.0.0', required: false, maxPriceAtomic: '1500000', maxCalls: 1 }],
  },
  warnings: [{ code: 'OPTIONAL_DEPENDENCY_NOT_RESOLVED', dependencyId: 'dependency-id', targetAgentId: 'risk-id', targetAgentSlug: 'risk', versionConstraint: '^1.0.0' }],
}

afterEach(() => cleanup())
beforeEach(() => vi.resetAllMocks())

describe('QuotePanel', () => {
  it('issues a typed quote and renders maximum cost, warning, and graph', async () => {
    createAgentQuoteMock.mockResolvedValue(quote)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><QuotePanel slug="investment" version={version} /></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
    expect((await screen.findAllByText('2.5 USDC')).length).toBeGreaterThan(0)
    expect(screen.getByRole('note')).toHaveTextContent('risk')
    expect(screen.getByRole('heading', { name: 'Quoted dependency graph' })).toBeInTheDocument()
    expect(createAgentQuoteMock).toHaveBeenCalledWith('investment', { versionConstraint: '1.0.0' })
  })
})
