import { createServer } from 'node:http'

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization, accept',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

const demoDeveloper = { id: '00000000-0000-0000-0000-00000000d001', displayName: 'Browser Fixture Developer' }
const now = '2026-09-05T00:00:00.000Z'
const demoAgent = {
  id: 'browser-agent-1',
  developerId: demoDeveloper.id,
  developerName: demoDeveloper.displayName,
  code: 'browser-demo-agent',
  name: 'Browser Demo Agent',
  description: '브라우저에서 실제 비용 확인과 실행 흐름을 확인하는 Agent입니다.',
  usageType: 'user_facing',
  dependencyCount: 0,
  versions: [{
    id: 'browser-version-1',
    agentId: 'browser-agent-1',
    functionContractId: null,
    semver: '1.0.0',
    status: 'ACTIVE',
    endpoint: 'http://127.0.0.1:8090/agents/browser-demo-agent/invoke',
    priceAtomic: '10000',
    network: 'eip155:84532',
    asset: 'USDC',
    payTo: '0x0000000000000000000000000000000000000001',
    responseFormat: 'MARKDOWN',
    createdAt: now,
    updatedAt: now,
  }],
  createdAt: now,
  updatedAt: now,
}
const write = (response, status, result, message = 'ok') => {
  response.writeHead(status, { ...corsHeaders, 'content-type': 'application/json', 'X-Trace-Id': 'browser-fixture-trace' })
  response.end(JSON.stringify({ isSuccess: status < 400, message, errorCode: status < 400 ? null : `FIXTURE_${status}`, result }))
}

// Every browser context owns one scenario. This is a local HTTP server, not a
// browser request interceptor; the application still uses its generated client.
corsHeaders['access-control-allow-headers'] += ', x-fixture-id, last-event-id'
corsHeaders['access-control-expose-headers'] = 'X-Trace-Id'
const scenarios = new Map()
function scenario(id) {
  if (!scenarios.has(id)) scenarios.set(id, { mode: 'success', requests: [], quotes: [], execution: null })
  return scenarios.get(id)
}
function agentFor(state) {
  const agent = structuredClone(demoAgent)
  if (state.mode === 'draft' && !state.published) agent.versions[0].status = 'DRAFT'
  return agent
}
function snapshot(state) {
  const agent = agentFor(state)
  return { version: { ...agent.versions[0], agentCode: agent.code, agentName: agent.name, agentDescription: agent.description }, dependencies: [] }
}
function execution(state) {
  const reconciliation = state.mode === 'reconciliation'
  const partial = state.mode === 'partial'
  const running = !state.finished && !reconciliation && !partial
  const status = reconciliation || partial ? 'FAILED' : running ? 'RUNNING' : 'COMPLETED'
  const step = { id: 'root-step', agentVersionId: 'browser-version-1', status, failureCode: reconciliation ? 'PAYMENT_RECONCILIATION_REQUIRED' : partial ? 'PROVIDER_FAILED' : null, costAtomic: running || reconciliation ? '0' : '10000', responseFormat: 'MARKDOWN', output: running || reconciliation || partial ? null : '## 브라우저 분석 결과\n예산에 맞는 유선 헤드셋을 비교했습니다.', payments: reconciliation ? [{ id: 'payment-1', status: 'RECONCILIATION_REQUIRED', amountAtomic: '10000' }] : running ? [] : [{ id: 'payment-1', status: 'SETTLED', amountAtomic: '10000', transactionHash: `0x${'a'.repeat(64)}` }], createdAt: now, updatedAt: now }
  const steps = partial ? [step, { ...step, id: 'child-step', parentStepId: 'root-step', agentVersionId: 'child-version', status: 'COMPLETED', output: '완료된 리뷰 분석 내용입니다.' }] : [step]
  return { id: 'browser-execution-1', quoteId: state.quotes.at(-1)?.id ?? 'quote-1', status, maxBudgetAtomic: '10000', reservedCostAtomic: reconciliation ? '10000' : '0', actualCostAtomic: running || reconciliation ? '0' : '10000', question: state.execution?.question ?? '10만원대 헤드셋 추천해줘', steps, quoteSnapshot: snapshot(state), createdAt: now, updatedAt: now }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost')
  const path = requestUrl.pathname
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders)
    response.end()
    return
  }
  if (path.startsWith('/__scenario/')) {
    const state = scenario(path.split('/').at(-1))
    if (request.method === 'POST') Object.assign(state, JSON.parse(await readBody(request)))
    write(response, 200, state)
    return
  }
  const state = scenario(request.headers['x-fixture-id'] ?? 'default')
  const body = request.method === 'POST' ? await readBody(request) : ''
  state.requests.push({ method: request.method, path, query: requestUrl.search, body, authorization: request.headers.authorization ?? null })
  if (request.method === 'GET' && path === '/health') {
    write(response, 200, { status: 'UP' })
    return
  }
  if (request.method === 'POST' && path === '/api/demo/access') {
    write(response, 200, { accessToken: 'fixture-browser-access', expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() })
    return
  }
  const publicRead = request.method === 'GET' && (path === '/api/agents' || path.startsWith('/api/agents/') || path.endsWith('/dependencies') || path === '/api/function-contracts')
  if (!publicRead && (request.headers.authorization !== 'Bearer fixture-browser-access' || state.mode === 'unauthorized')) {
    write(response, 401, null, 'unauthorized')
    return
  }
  if (request.method === 'GET' && path === '/api/developer/me') {
    write(response, 200, demoDeveloper)
    return
  }
  if (request.method === 'GET' && path === '/api/developer/agents') {
    write(response, 200, [agentFor(state)])
    return
  }
  if (request.method === 'GET' && path === '/api/developer/revenue') {
    write(response, 200, { developerId: demoDeveloper.id, totalRevenueAtomic: '0', directRevenueAtomic: '0', dependencyRevenueAtomic: '0', directCount: 0, dependencyCount: 0, entries: [], nextCursor: null })
    return
  }
  if (request.method === 'GET' && path === '/api/agents') {
    if (state.mode === 'empty') { write(response, 200, { items: [], nextCursor: null }); return }
    if (requestUrl.searchParams.get('q') === 'error') {
      write(response, 503, null, 'Marketplace를 잠시 불러올 수 없습니다.')
      return
    }
    if (requestUrl.searchParams.get('q') === 'none') {
      write(response, 200, { items: [], nextCursor: null })
      return
    }
    const agent = agentFor(state)
    write(response, 200, { items: agent.versions.some((version) => version.status === 'ACTIVE') ? [agent] : [], nextCursor: null })
    return
  }
  if (request.method === 'GET' && path === '/api/agents/browser-demo-agent') {
    write(response, 200, agentFor(state))
    return
  }
  if (request.method === 'POST' && path === '/api/agent-versions/browser-version-1/publish') {
    state.published = true
    write(response, 200, agentFor(state).versions[0])
    return
  }
  if (request.method === 'GET' && (path.endsWith('/dependencies') || path === '/api/function-contracts')) { write(response, 200, []); return }
  if (request.method === 'POST' && path.endsWith('/quotes')) {
    const quote = { id: `quote-${state.quotes.length + 1}`, rootVersionId: 'browser-version-1', warnings: [], maxCostAtomic: '10000', snapshot: snapshot(state), expiresAt: new Date(Date.now() + (state.mode === 'expired-quote' && state.quotes.length === 0 ? -1000 : 300000)).toISOString(), createdAt: now }
    state.quotes.push(quote)
    write(response, 201, quote)
    return
  }
  if (request.method === 'POST' && path === '/api/executions') {
    state.execution = JSON.parse(body)
    write(response, 201, execution(state))
    return
  }
  if (path === '/api/executions/browser-execution-1/events') {
    response.writeHead(200, { ...corsHeaders, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
    response.write(': connected\n\n')
    const timer = setTimeout(() => {
      state.finished = true
      const terminal = state.mode === 'reconciliation' || state.mode === 'partial' ? 'EXECUTION_FAILED' : 'EXECUTION_COMPLETED'
      response.end(`id: 1\nevent: ${terminal}\ndata: ${JSON.stringify({ terminal: true })}\n\n`)
    }, 300)
    response.on('close', () => clearTimeout(timer))
    return
  }
  if (path === '/api/executions/browser-execution-1') { write(response, 200, execution(state)); return }
  write(response, 404, null, 'not found')
})

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

server.listen(18080, '127.0.0.1')
process.on('SIGTERM', () => server.close(() => process.exit(0)))
process.on('SIGINT', () => server.close(() => process.exit(0)))
