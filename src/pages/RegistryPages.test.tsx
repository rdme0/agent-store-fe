import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAgentVersion,
  disableAgentVersion,
  getAgentBySlug,
  listMarketplaceAgents,
  publishAgentVersion,
  registerAgent,
} from '../entities/agent/api'
import type { AgentModel, AgentVersionModel } from '../entities/agent/model'
import { listFunctionContracts } from '../entities/function-contract/api'
import { AgentDetailPage } from './AgentDetailPage'
import { AgentsPage } from './AgentsPage'
import { NewAgentVersionPage } from './NewAgentVersionPage'
import { RegisterAgentPage } from './RegisterAgentPage'

vi.mock('../entities/agent/api', () => ({
  createAgentVersion: vi.fn(),
  disableAgentVersion: vi.fn(),
  getAgentBySlug: vi.fn(),
  listMarketplaceAgents: vi.fn(),
  publishAgentVersion: vi.fn(),
  registerAgent: vi.fn(),
}))
vi.mock('../entities/function-contract/api', () => ({ listFunctionContracts: vi.fn() }))
vi.mock('../shared/config/env', () => ({
  API_BASE_URL: 'http://localhost:8080',
  DEMO_DEVELOPER_ID: '123e4567-e89b-12d3-a456-426614174000',
  env: { apiBaseUrl: 'http://localhost:8080', demoDeveloperId: '123e4567-e89b-12d3-a456-426614174000' },
}))

const listMarketplaceAgentsMock = vi.mocked(listMarketplaceAgents)
const getAgentBySlugMock = vi.mocked(getAgentBySlug)
const createAgentVersionMock = vi.mocked(createAgentVersion)
const disableAgentVersionMock = vi.mocked(disableAgentVersion)
const publishAgentVersionMock = vi.mocked(publishAgentVersion)
const registerAgentMock = vi.mocked(registerAgent)
const listFunctionContractsMock = vi.mocked(listFunctionContracts)

const baseAgent: AgentModel = {
  id: 'agent-id',
  developerId: 'developer-id',
  developerName: 'Demo Developer',
  slug: 'demo-agent',
  name: 'Demo Agent',
  description: 'Fixture agent',
  dependencyCount: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  versions: [{
    id: 'version-id',
    agentId: 'agent-id',
    semver: '1.0.0',
    status: 'ACTIVE',
    endpoint: 'http://localhost:8090/agents/demo',
    priceAtomic: '10000',
    priceLabel: '0.01 USDC',
    network: 'eip155:84532',
    asset: 'USDC',
    payTo: '0x0000000000000000000000000000000000000001',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
}

function renderWithQuery(element: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={queryClient}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>)
  return queryClient
}

function renderRoute(path: string, route: { path: string; element: React.ReactElement }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([route], { initialEntries: [path] })
  render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>)
  return queryClient
}

beforeEach(() => {
  vi.resetAllMocks()
  listFunctionContractsMock.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
})

describe('Marketplace public states', () => {
  it('renders an empty state with a registration CTA', async () => {
    listMarketplaceAgentsMock.mockResolvedValue({ items: [], nextCursor: null })
    renderWithQuery(<AgentsPage />)

    expect(await screen.findByRole('heading', { name: '등록된 Agent가 없습니다.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Agent 등록하기' })).toHaveAttribute('href', '/agents/new')
  })

  it('renders an API error and retries the list query', async () => {
    listMarketplaceAgentsMock.mockRejectedValue(new Error('목록 API 오류'))
    renderWithQuery(<AgentsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('목록 API 오류')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(listMarketplaceAgentsMock).toHaveBeenCalledTimes(2))
  })

  it('passes search, sort, and the selected display mode to the Marketplace adapter', async () => {
    listMarketplaceAgentsMock.mockResolvedValue({ items: [baseAgent], nextCursor: null })
    renderWithQuery(<AgentsPage />)

    await screen.findByRole('heading', { name: 'Demo Agent' })
    fireEvent.change(screen.getByLabelText('Agent 검색'), { target: { value: 'risk' } })
    fireEvent.change(screen.getByLabelText('정렬'), { target: { value: 'name_asc' } })
    fireEvent.submit(screen.getByRole('search'))

    await waitFor(() => expect(listMarketplaceAgentsMock).toHaveBeenLastCalledWith({ cursor: undefined, limit: 12, q: 'risk', sort: 'name_asc', view: 'developer' }))
    expect(await screen.findByRole('heading', { name: 'Demo Agent' })).toBeInTheDocument()
  })

  it('displays the dependency count returned by the Marketplace API', async () => {
    listMarketplaceAgentsMock.mockResolvedValue({ items: [{ ...baseAgent, dependencyCount: 3, versions: [] }], nextCursor: null })
    renderWithQuery(<AgentsPage />)

    expect(await screen.findByText('의존성 수')).toBeInTheDocument()
    expect(await screen.findByText('3개')).toBeInTheDocument()
  })

  it('shows the active Version price in one card-wide detail and execution navigation', async () => {
    listMarketplaceAgentsMock.mockResolvedValue({ items: [baseAgent], nextCursor: null })
    renderWithQuery(<AgentsPage />)

    expect(await screen.findByText('기본 호출 비용')).toBeInTheDocument()
    expect(screen.getByText('0.01 USDC')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Demo Agent 상세 및 실행' })).toHaveAttribute('href', '/agents/demo-agent')
    expect(screen.getByText('상세 및 실행')).toBeInTheDocument()
  })

  it('appends the next cursor page once when load more is clicked twice in the same tick', async () => {
    let resolveNextPage: ((value: { items: AgentModel[]; nextCursor: null }) => void) | undefined
    listMarketplaceAgentsMock
      .mockResolvedValueOnce({ items: [baseAgent], nextCursor: 'next-cursor' })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNextPage = resolve }))
    renderWithQuery(<AgentsPage />)

    await screen.findByRole('button', { name: '더 보기' })
    const loadMore = screen.getByRole('button', { name: '더 보기' })
    fireEvent.click(loadMore)
    fireEvent.click(loadMore)
    expect(listMarketplaceAgentsMock).toHaveBeenCalledTimes(2)

    resolveNextPage?.({ items: [{ ...baseAgent, id: 'second-agent', slug: 'second-agent', name: 'Second Agent' }], nextCursor: null })
    expect(await screen.findByRole('heading', { name: 'Second Agent' })).toBeInTheDocument()
  })
})

describe('Agent detail actions', () => {
  it('requires confirmation, serializes the action, and invalidates the relevant queries', async () => {
    getAgentBySlugMock.mockResolvedValue(baseAgent)
    publishAgentVersionMock.mockResolvedValue({ ...baseAgent.versions[0], status: 'ACTIVE' })
    disableAgentVersionMock.mockResolvedValue({ ...baseAgent.versions[0], status: 'DISABLED' })
    const queryClient = renderRoute('/agents/demo-agent', { path: '/agents/:slug', element: <AgentDetailPage /> })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    expect(await screen.findByRole('heading', { name: 'Demo Agent' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '비활성화' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Version을 비활성화할까요?')
    fireEvent.click(screen.getAllByRole('button', { name: '비활성화' }).at(-1)!)
    await waitFor(() => expect(disableAgentVersionMock).toHaveBeenCalledTimes(1))
    expect(disableAgentVersionMock).toHaveBeenCalledWith('version-id')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['agent', 'demo-agent'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['agents'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['marketplace-agents'] })
    expect(await screen.findByRole('status')).toHaveTextContent('Version을 비활성화했습니다.')
  })

  it('returns focus to the triggering action and blocks duplicate confirmation clicks', async () => {
    let resolveDisable: ((value: AgentVersionModel) => void) | undefined
    getAgentBySlugMock.mockResolvedValue(baseAgent)
    disableAgentVersionMock.mockImplementationOnce(() => new Promise((resolve) => { resolveDisable = resolve }))
    renderRoute('/agents/demo-agent', { path: '/agents/:slug', element: <AgentDetailPage /> })

    const trigger = await screen.findByRole('button', { name: '비활성화' })
    fireEvent.click(screen.getByRole('button', { name: '비활성화' }))
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(trigger).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: '비활성화' }))
    const confirm = screen.getAllByRole('button', { name: '비활성화' }).at(-1)!
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    await waitFor(() => expect(disableAgentVersionMock).toHaveBeenCalledTimes(1))
    resolveDisable?.({ ...baseAgent.versions[0], status: 'DISABLED' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: '비활성화' })).toHaveFocus())
  })
})

describe('New Version flow', () => {
  it('shows query error retry and invalidates cached lists before navigation', async () => {
    getAgentBySlugMock.mockRejectedValueOnce(new Error('Agent 조회 오류')).mockResolvedValue(baseAgent)
    const queryClient = renderRoute('/agents/demo-agent/versions/new', { path: '/agents/:slug/versions/new', element: <NewAgentVersionPage /> })

    expect(await screen.findByRole('alert')).toHaveTextContent('Agent 조회 오류')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('heading', { name: '새 Version을 추가하세요.' })).toBeInTheDocument()

    createAgentVersionMock.mockResolvedValue({ ...baseAgent.versions[0], id: 'new-version-id', status: 'DRAFT' })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    fireEvent.change(screen.getByLabelText(/^SemVer/), { target: { value: '1.1.0' } })
    fireEvent.change(screen.getByLabelText(/^Endpoint/), { target: { value: 'http://localhost:8090/agents/demo-v2' } })
    fireEvent.change(screen.getByLabelText(/가격 \(atomic USDC\)/), { target: { value: '20000' } })
    fireEvent.change(screen.getByLabelText(/PayTo wallet/), { target: { value: '0x0000000000000000000000000000000000000001' } })
    fireEvent.click(screen.getByRole('button', { name: 'DRAFT Version 생성' }))
    await waitFor(() => expect(createAgentVersionMock).toHaveBeenCalledWith('agent-id', expect.objectContaining({ semver: '1.1.0' })))
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['agent', 'demo-agent'] }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['agents'] })
  })
})

describe('Agent registration flow', () => {
  it('invalidates the Marketplace before navigating after registration', async () => {
    registerAgentMock.mockResolvedValue(baseAgent)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter([
      { path: '/agents/new', element: <RegisterAgentPage /> },
      { path: '/agents/:slug', element: <p>Agent detail route</p> },
    ], { initialEntries: ['/agents/new'] })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>)

    fireEvent.change(await screen.findByLabelText(/Agent 주소/), { target: { value: 'demo-agent' } })
    fireEvent.change(screen.getByLabelText(/Agent 이름/), { target: { value: 'Demo Agent' } })
    fireEvent.change(screen.getByLabelText(/^설명/), { target: { value: 'Fixture agent' } })
    fireEvent.change(screen.getByLabelText(/수익 수령 지갑/), { target: { value: '0x0000000000000000000000000000000000000001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agent 등록' }))

    await waitFor(() => expect(registerAgentMock).toHaveBeenCalledWith(expect.objectContaining({ slug: 'demo-agent' })))
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['agents'] }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['marketplace-agents'] })
    expect(await screen.findByText('Agent detail route')).toBeInTheDocument()
  })
})
