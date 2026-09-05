/// <reference types="node" />

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getApiDeveloperMe } from '../../generated'
import { requestDemoAccess } from '../../entities/developer/demoAccessApi'
import { agentStoreClient } from './generatedClient'
import { clearDemoAccess, currentDemoAccess, storeDemoAccess } from '../auth/demoAccess'

describe('generated client demo access transport', () => {
  let server: Server
  let port = 0
  let mode: 'success' | 'unauthorized' = 'success'
  let authorization = ''
  let demoRequestBody = 'not-called'

  beforeEach(async () => {
    server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
      if (request.method === 'POST' && request.url === '/api/demo/access') {
        demoRequestBody = await readBody(request)
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({
          isSuccess: true,
          message: 'success',
          errorCode: null,
          result: { accessToken: 'fixture-access-token', expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() },
        }))
        return
      }
      authorization = request.headers.authorization ?? ''
      if (mode === 'unauthorized') {
        response.writeHead(401, { 'Content-Type': 'application/json', 'X-Trace-Id': 'fixture-trace' })
        response.end(JSON.stringify({ isSuccess: false, message: 'unauthorized', errorCode: 'COMMON_401_002', result: null }))
        return
      }
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({
        isSuccess: true,
        message: 'success',
        errorCode: null,
        result: { id: '00000000-0000-0000-0000-000000000001', displayName: 'Demo Developer' },
      }))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as { port: number }).port
    agentStoreClient.setConfig({ baseUrl: `http://127.0.0.1:${port}`, headers: { Accept: 'application/json' } })
    window.localStorage.clear()
  })

  afterEach(async () => {
    clearDemoAccess()
    agentStoreClient.setConfig({ baseUrl: 'http://localhost:8080', headers: { Accept: 'application/json' } })
    await new Promise<void>((resolve, reject) => server.close((error: Error | undefined) => error ? reject(error) : resolve()))
  })

  it('stores a one-year access record and sends its Bearer token over real HTTP', async () => {
    storeDemoAccess({ accessToken: 'fixture-access-token', expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() })

    const result = await getApiDeveloperMe({ client: agentStoreClient, throwOnError: true })

    expect(result.response.status).toBe(200)
    expect(result.data.result?.displayName).toBe('Demo Developer')
    expect(authorization).toBe('Bearer fixture-access-token')
    expect(currentDemoAccess()?.accessToken).toBe('fixture-access-token')
  })

  it('issues demo access through a bodyless POST', async () => {
    agentStoreClient.setConfig({ baseUrl: `http://127.0.0.1:${port}`, headers: { Accept: 'application/json' } })

    const access = await requestDemoAccess()

    expect(access.accessToken).toBe('fixture-access-token')
    expect(Date.parse(access.expiresAt) - Date.now()).toBeGreaterThan(364 * 24 * 60 * 60 * 1000)
    expect(demoRequestBody).toBe('')
  })

  it('clears the access record when the API returns an authentication failure', async () => {
    mode = 'unauthorized'
    storeDemoAccess({ accessToken: 'expired-at-server', expiresAt: new Date(Date.now() + 60_000).toISOString() })

    await expect(getApiDeveloperMe({ client: agentStoreClient, throwOnError: true })).rejects.toBeDefined()

    expect(authorization).toBe('Bearer expired-at-server')
    expect(currentDemoAccess()).toBeUndefined()
  })
})

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}
