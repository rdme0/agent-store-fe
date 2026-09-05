import { createServer } from 'node:http'

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization, accept',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

const demoDeveloper = { id: '00000000-0000-0000-0000-00000000d001', displayName: 'Browser Fixture Developer' }
const write = (response, status, result, message = 'ok') => {
  response.writeHead(status, { ...corsHeaders, 'content-type': 'application/json' })
  response.end(JSON.stringify({ isSuccess: status < 400, message, result }))
}

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders)
    response.end()
    return
  }
  if (request.method === 'GET' && path === '/health') {
    write(response, 200, { status: 'UP' })
    return
  }
  if (request.method === 'POST' && path === '/api/demo/access') {
    write(response, 200, { accessToken: 'fixture-browser-access', expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() })
    return
  }
  if (request.headers.authorization !== 'Bearer fixture-browser-access') {
    write(response, 401, null, 'unauthorized')
    return
  }
  if (request.method === 'GET' && path === '/api/developer/me') {
    write(response, 200, demoDeveloper)
    return
  }
  if (request.method === 'GET' && path === '/api/developer/agents') {
    write(response, 200, [])
    return
  }
  if (request.method === 'GET' && path === '/api/developer/revenue') {
    write(response, 200, { developerId: demoDeveloper.id, totalRevenueAtomic: '0', directRevenueAtomic: '0', dependencyRevenueAtomic: '0', directCount: 0, dependencyCount: 0, entries: [], nextCursor: null })
    return
  }
  if (request.method === 'GET' && path === '/api/agents') {
    write(response, 200, { items: [], nextCursor: null })
    return
  }
  write(response, 404, null, 'not found')
})

server.listen(18080, '127.0.0.1')
process.on('SIGTERM', () => server.close(() => process.exit(0)))
process.on('SIGINT', () => server.close(() => process.exit(0)))
