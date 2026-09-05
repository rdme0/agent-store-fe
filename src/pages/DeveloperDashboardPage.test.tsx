import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { DeveloperDashboardPage } from './DeveloperDashboardPage'
import { agentStoreClient } from '../shared/api/generatedClient'
import { clearDemoAccess, storeDemoAccess } from '../shared/auth/demoAccess'

async function dashboardFixture() {
  const now = new Date().toISOString()
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    const write = (status: number, result: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ isSuccess: status < 400, message: status < 400 ? 'ok' : 'error', result }))
    }
    if (request.headers.authorization !== 'Bearer fixture-token') return write(401, null)
    if (request.method === 'GET' && path === '/api/developer/me') return write(200, { id: '00000000-0000-0000-0000-00000000d001', displayName: 'Demo Developer' })
    if (request.method === 'GET' && path === '/api/developer/agents') return write(200, [{ id: 'agent-1', developerId: '00000000-0000-0000-0000-00000000d001', developerName: 'Demo Developer', code: 'demo-agent', name: 'Demo Agent', description: 'fixture', usageType: 'user_facing', dependencyCount: 0, versions: [{ id: 'version-1', agentId: 'agent-1', functionContractId: null, semver: '1.0.0', status: 'ACTIVE', endpoint: 'http://fixture.test', priceAtomic: '10000', network: 'base-sepolia', asset: 'USDC', payTo: '0x0000000000000000000000000000000000000001', responseFormat: 'JSON', createdAt: now, updatedAt: now }], createdAt: now, updatedAt: now }])
    if (request.method === 'GET' && path === '/api/developer/revenue') return write(200, { developerId: '00000000-0000-0000-0000-00000000d001', totalRevenueAtomic: '0', directRevenueAtomic: '0', dependencyRevenueAtomic: '0', directCount: 0, dependencyCount: 0, entries: [], nextCursor: null })
    return write(404, null)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('fixture did not bind')
  return { baseUrl: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) }
}

function renderDashboard(baseUrl: string) {
  agentStoreClient.setConfig({ baseUrl, headers: { Accept: 'application/json' } })
  storeDemoAccess({ accessToken: 'fixture-token', expiresAt: new Date(Date.now() + 3_600_000).toISOString() })
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><DeveloperDashboardPage /></MemoryRouter></QueryClientProvider>)
}

afterEach(() => {
  clearDemoAccess()
  agentStoreClient.setConfig({ baseUrl: 'http://localhost:8080', headers: { Accept: 'application/json' } })
})

describe('DeveloperDashboardPage', () => {
  it('shows owned Agent status without a readiness or paid verification control', async () => {
    const fixture = await dashboardFixture()
    const rendered = renderDashboard(fixture.baseUrl)
    try {
      await waitFor(() => expect(screen.getByText('Demo Agent')).toBeInTheDocument())
      expect(screen.getByText('v1.0.0 · 공개됨 · 0.01 USDC')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /검증/ })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Agent 관리' })).toHaveAttribute('href', '/agents/demo-agent')
    } finally {
      rendered.unmount()
      await fixture.close()
    }
  })
})
