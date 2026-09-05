import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { DeveloperDashboardPage } from './DeveloperDashboardPage'
import { agentStoreClient } from '../shared/api/generatedClient'
import { clearDemoAccess, storeDemoAccess } from '../shared/auth/demoAccess'

interface DashboardFixture {
  server: Server
  baseUrl: string
  close: () => Promise<void>
  readonly verifyCalls: number
  readonly agentsCalls: number
  setVerifyFailure: (enabled: boolean) => void
}

async function createDashboardFixture(): Promise<DashboardFixture> {
  let verifyCalls = 0
  let agentsCalls = 0
  let verifyFailure = false
  let readiness: 'UNVERIFIED' | 'VERIFIED' = 'UNVERIFIED'
  const now = new Date().toISOString()
  const agent = () => ({
    id: 'agent-1', developerId: '00000000-0000-0000-0000-00000000d001', developerName: 'Demo Developer', code: 'demo-agent', name: 'Demo Agent', description: 'fixture', usageType: 'user_facing', dependencyCount: 0,
    versions: [{ id: 'version-1', agentId: 'agent-1', functionContractId: null, semver: '1.0.0', status: 'ACTIVE', endpoint: 'http://fixture.test', priceAtomic: '10000', network: 'base-sepolia', asset: 'USDC', payTo: '0x0000000000000000000000000000000000000001', responseFormat: 'JSON', readiness: { versionId: 'version-1', status: readiness, lastPaidCertificationAt: null, lastPreflightAt: null, certificationTransactionHash: null, failureCode: null }, createdAt: now, updatedAt: now }], createdAt: now, updatedAt: now,
  })
  const revenue = { developerId: '00000000-0000-0000-0000-00000000d001', totalRevenueAtomic: '0', directRevenueAtomic: '0', dependencyRevenueAtomic: '0', directCount: 0, dependencyCount: 0, entries: [], nextCursor: null }
  const write = (response: ServerResponse, status: number, result: unknown, message = 'ok') => {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ isSuccess: status < 400, message, result }))
  }
  const handler = (request: IncomingMessage, response: ServerResponse) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    if (request.headers.authorization !== 'Bearer fixture-token') {
      write(response, 401, null, 'unauthorized')
      return
    }
    if (request.method === 'GET' && path === '/api/developer/me') {
      write(response, 200, { id: '00000000-0000-0000-0000-00000000d001', displayName: 'Demo Developer' })
      return
    }
    if (request.method === 'GET' && path === '/api/developer/agents') {
      agentsCalls += 1
      write(response, 200, [agent()])
      return
    }
    if (request.method === 'GET' && path === '/api/developer/revenue') {
      write(response, 200, revenue)
      return
    }
    if (request.method === 'POST' && path === '/api/agent-versions/version-1/verify') {
      verifyCalls += 1
      if (verifyFailure) {
        write(response, 503, null, 'provider unavailable')
        return
      }
      readiness = 'VERIFIED'
      write(response, 200, agent().versions[0])
      return
    }
    write(response, 404, null, 'not found')
  }
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('fixture did not bind')
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    get verifyCalls() { return verifyCalls },
    get agentsCalls() { return agentsCalls },
    setVerifyFailure: (enabled) => { verifyFailure = enabled },
  }
}

function renderDashboard(baseUrl: string) {
  agentStoreClient.setConfig({ baseUrl, headers: { Accept: 'application/json' } })
  storeDemoAccess({ accessToken: 'fixture-token', expiresAt: new Date(Date.now() + 3600000).toISOString() })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><DeveloperDashboardPage /></MemoryRouter></QueryClientProvider>)
}

afterEach(() => {
  clearDemoAccess()
  agentStoreClient.setConfig({ baseUrl: 'http://localhost:8080', headers: { Accept: 'application/json' } })
})

describe('DeveloperDashboardPage', () => {
  it('loads owned versions, confirms verification, prevents duplicate clicks, and refreshes queries', async () => {
    const fixture = await createDashboardFixture()
    const rendered = renderDashboard(fixture.baseUrl)
    try {
      await waitFor(() => expect(screen.getByText('Demo Agent')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: '검증' }))
      expect(screen.getByText('실제 testnet 결제를 진행할까요?')).toBeInTheDocument()
      expect(screen.getByText(/Base Sepolia testnet x402 결제/)).toBeInTheDocument()
      const verifyButton = screen.getByRole('button', { name: '실제 결제 후 검증' })
      fireEvent.click(verifyButton)
      fireEvent.click(verifyButton)
      await waitFor(() => expect(fixture.verifyCalls).toBe(1))
      await waitFor(() => expect(screen.queryByText('실제 testnet 결제를 진행할까요?')).not.toBeInTheDocument())
      expect(fixture.agentsCalls).toBeGreaterThanOrEqual(2)
    } finally {
      rendered.unmount()
      await fixture.close()
    }
  })

  it('keeps the confirmation open and renders provider errors', async () => {
    const fixture = await createDashboardFixture()
    fixture.setVerifyFailure(true)
    const rendered = renderDashboard(fixture.baseUrl)
    try {
      await waitFor(() => expect(screen.getByText('Demo Agent')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: '검증' }))
      fireEvent.click(screen.getByRole('button', { name: '실제 결제 후 검증' }))
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('provider unavailable'))
      expect(screen.getByText('실제 testnet 결제를 진행할까요?')).toBeInTheDocument()
      expect(fixture.verifyCalls).toBe(1)
    } finally {
      rendered.unmount()
      await fixture.close()
    }
  })
})
