import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listAgents } from '../../entities/agent/api'
import type { AgentModel } from '../../entities/agent/model'
import { createDependency, listDependencies } from '../../entities/dependency/api'
import type { DependencyModel } from '../../entities/dependency/model'
import { listFunctionContracts } from '../../entities/function-contract/api'
import type { FunctionContractResponse } from '../../generated'
import { ApiRequestError } from '../../shared/api/client'
import { DependencyEditor } from './DependencyEditor'

vi.mock('../../entities/agent/api', () => ({ listAgents: vi.fn() }))
vi.mock('../../entities/function-contract/api', () => ({ listFunctionContracts: vi.fn() }))
vi.mock('../../entities/dependency/api', () => ({
  createDependency: vi.fn(),
  listDependencies: vi.fn(),
  removeDependency: vi.fn(),
  updateDependency: vi.fn(),
}))

const listAgentsMock = vi.mocked(listAgents)
const listDependenciesMock = vi.mocked(listDependencies)
const createDependencyMock = vi.mocked(createDependency)
const listFunctionContractsMock = vi.mocked(listFunctionContracts)

const agent: AgentModel = {
  id: 'source-agent', developerId: 'developer', developerName: 'Developer', slug: 'investment', name: 'Investment',
  description: 'Fixture', dependencyCount: 0, createdAt: '', updatedAt: '', versions: [],
}
const target: AgentModel = {
  ...agent, id: 'target-agent', slug: 'risk', name: 'Risk',
}
const dependency: DependencyModel = {
  id: 'dependency-id', sourceVersionId: 'version-id', targetAgentId: target.id, targetAgentSlug: target.slug,
  versionConstraint: '^1.0.0', required: false, maxPriceAtomic: '1000000', maxPriceLabel: '1 USDC', maxCalls: 2,
  createdAt: '', updatedAt: '',
}
const functionContract = {
  id: 'function-contract-id', code: 'stock-news-analysis', contractVersion: '1.0.0', name: '뉴스 분석',
  description: '뉴스 분석 계약', responseFormat: 'JSON', inputSchema: { type: 'object' }, outputSchema: { type: 'object' },
  createdAt: '', updatedAt: '',
} as FunctionContractResponse

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
  listFunctionContractsMock.mockResolvedValue([functionContract])
})

afterEach(() => cleanup())

describe('DependencyEditor', () => {
  it('renders the dependency graph and invalidates it after adding a dependency', async () => {
    const queryClient = renderEditor()
    createDependencyMock.mockResolvedValue(dependency)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)

    expect(await screen.findByRole('heading', { name: 'v1.0.0 Dependencies' })).toBeInTheDocument()
    expect(screen.getAllByText('risk').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('필요한 기능'), { target: { value: functionContract.id } })
    fireEvent.change(screen.getByLabelText('공급자 범위'), { target: { value: 'pinned' } })
    fireEvent.change(screen.getByLabelText('고정 Agent'), { target: { value: target.id } })
    fireEvent.change(screen.getByLabelText('Max price (atomic USDC)'), { target: { value: '1000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dependency 추가' }))

    await waitFor(() => expect(createDependencyMock).toHaveBeenCalledWith('version-id', expect.objectContaining({ targetAgentId: target.id, maxPriceAtomic: '1000000' })))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dependencies', 'version-id'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['quote', 'investment'] })
  })

  it('shows the full cycle path returned by the API', async () => {
    createDependencyMock.mockRejectedValue(new ApiRequestError(
      '의존성 순환이 감지되었습니다. 경로: investment -> risk -> investment',
      409,
      { errorCode: 'DEPENDENCY_409_003' },
    ))
    renderEditor()

    expect(await screen.findByRole('heading', { name: 'v1.0.0 Dependencies' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('필요한 기능'), { target: { value: functionContract.id } })
    fireEvent.change(screen.getByLabelText('공급자 범위'), { target: { value: 'pinned' } })
    fireEvent.change(screen.getByLabelText('고정 Agent'), { target: { value: target.id } })
    fireEvent.change(screen.getByLabelText('Max price (atomic USDC)'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dependency 추가' }))

    expect(await screen.findByText('investment → risk → investment')).toBeInTheDocument()
  })

  it('requires an explicit Marketplace strategy and sends a function dependency', async () => {
    createDependencyMock.mockResolvedValue(dependency)
    renderEditor()

    expect(await screen.findByRole('heading', { name: 'v1.0.0 Dependencies' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('필요한 기능'), { target: { value: functionContract.id } })
    fireEvent.change(screen.getByLabelText('Max price (atomic USDC)'), { target: { value: '1000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dependency 추가' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('공급자 선택 정책을 선택하세요.')
    expect(createDependencyMock).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('선택 전략'), { target: { value: 'latest_version' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dependency 추가' }))

    await waitFor(() => expect(createDependencyMock).toHaveBeenCalledWith('version-id', expect.objectContaining({
      functionContractId: functionContract.id,
      providerScope: 'marketplace',
      selectionStrategy: 'latest_version',
      targetAgentId: undefined,
    })))
  })

  it('shows function contract query failure and retries without treating it as an empty list', async () => {
    listFunctionContractsMock.mockRejectedValueOnce(new Error('기능 계약 조회 실패'))
    renderEditor()

    expect(await screen.findByRole('alert')).toHaveTextContent('기능 계약 조회 실패')
    listFunctionContractsMock.mockResolvedValue([functionContract])
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByRole('heading', { name: 'v1.0.0 Dependencies' })).toBeInTheDocument()
    expect(listFunctionContractsMock).toHaveBeenCalledTimes(2)
  })

  it('creates a Marketplace function dependency when no direct target agent exists', async () => {
    listAgentsMock.mockResolvedValue([agent])
    createDependencyMock.mockResolvedValue(dependency)
    renderEditor()

    expect(await screen.findByRole('heading', { name: 'v1.0.0 Dependencies' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('필요한 기능'), { target: { value: functionContract.id } })
    fireEvent.change(screen.getByLabelText('선택 전략'), { target: { value: 'lowest_price' } })
    fireEvent.change(screen.getByLabelText('Max price (atomic USDC)'), { target: { value: '1000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dependency 추가' }))

    await waitFor(() => expect(createDependencyMock).toHaveBeenCalledWith('version-id', expect.objectContaining({
      functionContractId: functionContract.id,
      providerScope: 'marketplace',
      selectionStrategy: 'lowest_price',
    })))
  })

  it('coalesces same-tick dependency creation before pending state renders', async () => {
    createDependencyMock.mockImplementation(() => new Promise<DependencyModel>(() => undefined))
    renderEditor()

    expect(await screen.findByRole('heading', { name: 'v1.0.0 Dependencies' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('필요한 기능'), { target: { value: functionContract.id } })
    fireEvent.change(screen.getByLabelText('공급자 범위'), { target: { value: 'pinned' } })
    fireEvent.change(screen.getByLabelText('고정 Agent'), { target: { value: target.id } })
    fireEvent.change(screen.getByLabelText('Max price (atomic USDC)'), { target: { value: '1000' } })
    const form = screen.getByRole('button', { name: 'Dependency 추가' }).closest('form')
    expect(form).not.toBeNull()
    fireEvent.submit(form!)
    fireEvent.submit(form!)

    await waitFor(() => expect(createDependencyMock).toHaveBeenCalledTimes(1))
  })
})
