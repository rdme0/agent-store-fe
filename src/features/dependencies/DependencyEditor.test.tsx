import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listAgents } from '../../entities/agent/api'
import type { AgentModel } from '../../entities/agent/model'
import { createDependency, listDependencies } from '../../entities/dependency/api'
import type { DependencyModel } from '../../entities/dependency/model'
import { ApiRequestError } from '../../shared/api/client'
import { DependencyEditor } from './DependencyEditor'

vi.mock('../../entities/agent/api', () => ({ listAgents: vi.fn() }))
vi.mock('../../entities/dependency/api', () => ({
  createDependency: vi.fn(),
  listDependencies: vi.fn(),
  removeDependency: vi.fn(),
  updateDependency: vi.fn(),
}))

const listAgentsMock = vi.mocked(listAgents)
const listDependenciesMock = vi.mocked(listDependencies)
const createDependencyMock = vi.mocked(createDependency)

const agent: AgentModel = {
  id: 'source-agent', developerId: 'developer', developerName: 'Developer', slug: 'investment', name: 'Investment',
  description: 'Fixture', createdAt: '', updatedAt: '', versions: [],
}
const target: AgentModel = {
  ...agent, id: 'target-agent', slug: 'risk', name: 'Risk',
}
const dependency: DependencyModel = {
  id: 'dependency-id', sourceVersionId: 'version-id', targetAgentId: target.id, targetAgentSlug: target.slug,
  versionConstraint: '^1.0.0', required: false, maxPriceAtomic: '1000000', maxPriceLabel: '1 USDC', maxCalls: 2,
  createdAt: '', updatedAt: '',
}

function renderEditor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={queryClient}><DependencyEditor agent={agent} slug={agent.slug} version={{
    id: 'version-id', agentId: agent.id, semver: '1.0.0', status: 'DRAFT', endpoint: 'http://localhost:8090',
    priceAtomic: '1000000', priceLabel: '1 USDC', network: 'eip155:84532', asset: 'USDC', payTo: '0x1', createdAt: '', updatedAt: '',
  }} /></QueryClientProvider>)
  return queryClient
}

beforeEach(() => {
  vi.resetAllMocks()
  listAgentsMock.mockResolvedValue([agent, target])
  listDependenciesMock.mockResolvedValue([dependency])
})

afterEach(() => cleanup())

describe('DependencyEditor', () => {
  it('renders the dependency graph and invalidates it after adding a dependency', async () => {
    const queryClient = renderEditor()
    createDependencyMock.mockResolvedValue(dependency)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)

    expect(await screen.findByRole('heading', { name: 'v1.0.0 Dependencies' })).toBeInTheDocument()
    expect(screen.getAllByText('risk').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Target Agent'), { target: { value: target.id } })
    fireEvent.change(screen.getByLabelText('Max price (atomic USDC)'), { target: { value: '1000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dependency 추가' }))

    await waitFor(() => expect(createDependencyMock).toHaveBeenCalledWith('version-id', expect.objectContaining({ targetAgentId: target.id, maxPriceAtomic: '1000000' })))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dependencies', 'version-id'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['quote', 'investment'] })
  })

  it('shows the full cycle path returned by the API', async () => {
    createDependencyMock.mockRejectedValue(new ApiRequestError('cycle', 409, {
      code: 'DEPENDENCY_CYCLE_DETECTED',
      details: { cycle: ['investment', 'risk', 'investment'] },
    }))
    renderEditor()

    expect(await screen.findByRole('heading', { name: 'v1.0.0 Dependencies' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Target Agent'), { target: { value: target.id } })
    fireEvent.change(screen.getByLabelText('Max price (atomic USDC)'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dependency 추가' }))

    expect(await screen.findByText('investment → risk → investment')).toBeInTheDocument()
  })
})
