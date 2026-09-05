import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { createServer, type ServerResponse } from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AgentDetailPage } from './AgentDetailPage'
import { AgentsPage } from './AgentsPage'
import { FunctionContractsPage } from './FunctionContractsPage'
import { NewAgentVersionPage } from './NewAgentVersionPage'
import { RegisterAgentPage } from './RegisterAgentPage'
import { DisplayModeProvider } from '../app/DisplayModeContext'
import { agentStoreClient } from '../shared/api/generatedClient'
import { storeDemoAccess } from '../shared/auth/demoAccess'

const version = { id: 'version-id', agentId: 'agent-id', semver: '1.0.0', status: 'ACTIVE', endpoint: 'http://localhost:8090/agents/demo', priceAtomic: '10000', network: 'eip155:84532', asset: 'USDC', payTo: '0x0000000000000000000000000000000000000001', responseFormat: 'JSON', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
const agent = { id: 'agent-id', developerId: 'developer-id', developerName: 'Demo Developer', code: 'demo-agent', name: 'Demo Agent', description: 'Fixture agent', dependencyCount: 3, usageType: 'user_facing', versions: [version], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
const contract = { id: 'contract-id', code: 'news-analysis', contractVersion: '1.0.0', name: '뉴스 분석', description: '뉴스를 분석합니다.', responseFormat: 'JSON', inputSchema: { type: 'object' }, outputSchema: { type: 'object' }, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
type RequestRecord = { method: string; url: URL; body: Record<string, unknown> }
type Reply = { status?: number; result?: unknown; message?: string }
let requests: RequestRecord[]
let handler: (request: RequestRecord) => Reply | Promise<Reply>
let closeServer: () => Promise<void>
const clients: QueryClient[] = []

beforeEach(async () => {
  requests = []
  handler = ({ method, url }) => {
    if (url.pathname === '/api/function-contracts') return { result: method === 'POST' ? contract : [] }
    if (url.pathname.endsWith('/providers')) return { result: [] }
    if (url.pathname === '/api/agents') return { result: method === 'POST' ? agent : { items: [agent], nextCursor: null } }
    if (url.pathname.endsWith('/disable')) return { result: { ...version, status: 'DISABLED' } }
    if (url.pathname.endsWith('/versions')) return { result: { ...version, status: 'DRAFT' } }
    if (url.pathname.startsWith('/api/agents/')) return { result: agent }
    return { status: 404, message: 'unknown fixture route' }
  }
  const server = createServer(async (request, response: ServerResponse) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const text = Buffer.concat(chunks).toString()
    const record = { method: request.method ?? 'GET', url: new URL(request.url ?? '/', 'http://localhost'), body: text ? JSON.parse(text) : {} }
    requests.push(record)
    const reply = await handler(record)
    const status = reply.status ?? 200
    response.writeHead(status, { 'content-type': 'application/json', 'x-trace-id': 'registry-fixture' })
    response.end(JSON.stringify({ isSuccess: status < 400, result: reply.result ?? null, message: reply.message ?? 'ok', errorCode: status >= 400 ? 'FIXTURE_ERROR' : null }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('fixture not bound')
  agentStoreClient.setConfig({ baseUrl: `http://127.0.0.1:${address.port}` })
  closeServer = () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  storeDemoAccess({ accessToken: 'fixture-token', expiresAt: new Date(Date.now() + 3600000).toISOString() })
  localStorage.setItem('agentstore.display-mode', 'developer')
})
afterEach(async () => {
  cleanup()
  for (const client of clients.splice(0)) client.clear()
  await closeServer()
  agentStoreClient.setConfig({ baseUrl: 'http://localhost:8080' })
  localStorage.clear()
})

function renderPage(element: React.ReactElement, path = '/marketplace', routePath = path) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  const router = createMemoryRouter([
    { path: routePath, element },
    ...(routePath === '/agents/:code' ? [] : [{ path: '/agents/:code', element: <p>Agent detail route</p> }]),
  ], { initialEntries: [path] })
  render(<QueryClientProvider client={client}><DisplayModeProvider><RouterProvider router={router} /></DisplayModeProvider></QueryClientProvider>)
  return { client, router }
}
function calls(method: string, path: string) { return requests.filter((request) => request.method === method && request.url.pathname === path) }
function next() { fireEvent.click(screen.getByRole('button', { name: '다음' })) }

describe('Marketplace public states', () => {
  it('renders a truthful empty state and recovery actions', async () => {
    handler = () => ({ result: { items: [], nextCursor: null } })
    renderPage(<AgentsPage />)
    expect(await screen.findByRole('heading', { name: '공개 조건을 충족한 Agent가 없습니다.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /다시 불러오기/ })).toBeInTheDocument()
  })
  it('renders an API error and retries the HTTP query', async () => {
    handler = () => ({ status: 503, message: '목록 API 오류' })
    renderPage(<AgentsPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('목록 API 오류')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(calls('GET', '/api/agents')).toHaveLength(2))
  })
  it('sends search and sort to the server and labels loaded count accurately', async () => {
    renderPage(<AgentsPage />)
    await screen.findByRole('heading', { name: 'Demo Agent' })
    fireEvent.change(screen.getByLabelText('Agent 검색'), { target: { value: 'risk' } })
    fireEvent.change(screen.getByLabelText('정렬'), { target: { value: 'name_asc' } })
    fireEvent.submit(screen.getByRole('search'))
    await waitFor(() => {
      const query = calls('GET', '/api/agents').at(-1)!.url.searchParams
      expect(query.get('q')).toBe('risk')
      expect(query.get('sort')).toBe('name_asc')
    })
    expect(await screen.findByText(/1개 표시/)).toBeInTheDocument()
  })
  it('shows server dependency count and the active base price in the detail link', async () => {
    renderPage(<AgentsPage />)
    expect(await screen.findByText('의존성 수')).toBeInTheDocument()
    expect(screen.getByText('3개')).toBeInTheDocument()
    expect(screen.getByText('0.01 USDC')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Demo Agent 상세 및 실행' })).toHaveAttribute('href', '/agents/demo-agent')
  })
  it('appends one HTTP cursor page despite same-tick duplicate clicks', async () => {
    let release: (() => void) | undefined
    handler = async ({ url }) => {
      if (!url.searchParams.has('cursor')) return { result: { items: [agent], nextCursor: 'next' } }
      await new Promise<void>((resolve) => { release = resolve })
      return { result: { items: [{ ...agent, id: 'second', code: 'second', name: 'Second Agent' }], nextCursor: null } }
    }
    renderPage(<AgentsPage />)
    const button = await screen.findByRole('button', { name: '더 보기' })
    fireEvent.click(button); fireEvent.click(button)
    await waitFor(() => expect(calls('GET', '/api/agents')).toHaveLength(2))
    release?.()
    expect(await screen.findByRole('heading', { name: 'Second Agent' })).toBeInTheDocument()
  })
})

describe('Function contract states', () => {
  it('renders an empty state without an empty contract-list column', async () => {
    renderPage(<FunctionContractsPage />)
    expect(await screen.findByText('등록된 기능 계약이 없습니다.')).toHaveClass('function-contract-empty')
    expect(document.querySelector('.function-contract-layout')).not.toBeInTheDocument()
  })
  it('uses code views for registered schemas', async () => {
    handler = ({ url }) => ({ result: url.pathname.endsWith('/providers') ? [] : [contract] })
    renderPage(<FunctionContractsPage />)
    expect(await screen.findByRole('region', { name: '입력 계약 JSON' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '출력 계약 JSON' })).toBeInTheDocument()
  })
  it('preserves formatted schema inputs and sends one request only at final review', async () => {
    renderPage(<FunctionContractsPage />)
    await screen.findByText('등록된 기능 계약이 없습니다.')
    fireEvent.change(screen.getByLabelText('기능 코드'), { target: { value: 'news-analysis' } })
    fireEvent.change(screen.getByLabelText('계약 Version'), { target: { value: '1.0.0' } })
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '뉴스 분석' } })
    fireEvent.change(screen.getByLabelText('설명'), { target: { value: '뉴스를 분석합니다.' } })
    next()
    fireEvent.click(screen.getAllByRole('button', { name: 'JSON 정렬' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'JSON 정렬' })[1])
    next()
    expect(calls('POST', '/api/function-contracts')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: '이전' }))
    expect((screen.getByLabelText('입력 계약 Schema') as HTMLTextAreaElement).value).toContain('"required"')
    next()
    const form = screen.getByRole('button', { name: '계약 등록' }).closest('form')!
    fireEvent.submit(form); fireEvent.submit(form)
    await waitFor(() => expect(calls('POST', '/api/function-contracts')).toHaveLength(1))
    expect(calls('POST', '/api/function-contracts')[0].body).toMatchObject({ inputSchema: { type: 'object', required: ['input'] }, outputSchema: { type: 'object' } })
  })
})

describe('Agent detail actions', () => {
  it('keeps the next route visible after the previous HTTP response arrives late', async () => {
    let release: (() => void) | undefined
    handler = async ({ url }) => {
      if (url.pathname.endsWith('/first-agent')) {
        await new Promise<void>((resolve) => { release = resolve })
        return { result: { ...agent, code: 'first-agent', name: 'First Agent' } }
      }
      return { result: { ...agent, code: 'second-agent', name: 'Second Agent' } }
    }
    const { router } = renderPage(<AgentDetailPage />, '/agents/first-agent', '/agents/:code')
    await waitFor(() => expect(calls('GET', '/api/agents/first-agent')).toHaveLength(1))
    await act(async () => { await router.navigate('/agents/second-agent') })
    expect(await screen.findByRole('heading', { name: 'Second Agent' })).toBeInTheDocument()
    await act(async () => { release?.() })
    expect(screen.queryByRole('heading', { name: 'First Agent' })).not.toBeInTheDocument()
  })
  it('confirms and serializes disable, invalidates cached lists, and returns focus', async () => {
    let release: (() => void) | undefined
    const fallback = handler
    handler = async (request) => {
      if (request.method === 'POST') await new Promise<void>((resolve) => { release = resolve })
      return fallback(request)
    }
    const { client } = renderPage(<AgentDetailPage />, '/agents/demo-agent', '/agents/:code')
    client.setQueryData(['marketplace-agents', 'cached'], [])
    client.setQueryData(['agents'], [])
    const trigger = await screen.findByRole('button', { name: '비활성화' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(trigger).toHaveFocus()
    fireEvent.click(trigger)
    const confirm = screen.getAllByRole('button', { name: '비활성화' }).at(-1)!
    fireEvent.click(confirm); fireEvent.click(confirm)
    await waitFor(() => expect(calls('POST', '/api/agent-versions/version-id/disable')).toHaveLength(1))
    release?.()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(client.getQueryState(['marketplace-agents', 'cached'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['agents'])?.isInvalidated).toBe(true)
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})

describe('Registration HTTP flows', () => {
  it('retries version lookup and invalidates lists after version creation', async () => {
    const fallback = handler
    let first = true
    handler = (request) => {
      if (request.url.pathname === '/api/agents/demo-agent' && first) { first = false; return { status: 503, message: 'Agent 조회 오류' } }
      return fallback(request)
    }
    const { client } = renderPage(<NewAgentVersionPage />, '/agents/demo-agent/versions/new', '/agents/:code/versions/new')
    client.setQueryData(['agents'], [])
    expect(await screen.findByRole('alert')).toHaveTextContent('Agent 조회 오류')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByRole('heading', { name: '새 Version을 추가하세요.' })
    fireEvent.change(screen.getByLabelText(/^SemVer/), { target: { value: '1.1.0' } })
    fireEvent.change(screen.getByLabelText(/^Endpoint/), { target: { value: 'http://localhost:8090/agents/demo-v2' } })
    fireEvent.change(screen.getByLabelText(/가격 \(atomic USDC\)/), { target: { value: '20000' } })
    fireEvent.change(screen.getByLabelText(/PayTo wallet/), { target: { value: version.payTo } })
    fireEvent.click(screen.getByRole('button', { name: 'DRAFT Version 생성' }))
    await waitFor(() => expect(calls('POST', '/api/agents/agent-id/versions')).toHaveLength(1))
    expect(calls('POST', '/api/agents/agent-id/versions')[0].body.semver).toBe('1.1.0')
    await waitFor(() => expect(client.getQueryState(['agents'])?.isInvalidated).toBe(true))
  })
  it('preserves fields and invalidates Marketplace only after final registration', async () => {
    const { client } = renderPage(<RegisterAgentPage />, '/agents/new')
    client.setQueryData(['marketplace-agents', 'cached'], [])
    client.setQueryData(['agents'], [])
    fireEvent.change(await screen.findByLabelText(/Agent 주소/), { target: { value: 'demo-agent' } })
    fireEvent.change(screen.getByLabelText(/Agent 이름/), { target: { value: 'Demo Agent' } })
    fireEvent.change(screen.getByLabelText(/^설명/), { target: { value: 'Fixture agent' } })
    next(); next()
    fireEvent.change(screen.getByLabelText(/수익 수령 지갑/), { target: { value: version.payTo } })
    next()
    expect(calls('POST', '/api/agents')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Agent 등록' }))
    expect(await screen.findByText('Agent detail route')).toBeInTheDocument()
    expect(calls('POST', '/api/agents')).toHaveLength(1)
    expect(calls('POST', '/api/agents')[0].body.code).toBe('demo-agent')
    expect(client.getQueryState(['agents'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['marketplace-agents', 'cached'])?.isInvalidated).toBe(true)
  })
})
