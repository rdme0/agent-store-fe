import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { AgentVersionModel } from '../../entities/agent/model'
import type { QuoteResponse } from '../../generated'
import { QuotePanel } from './QuotePanel'
import { agentStoreClient } from '../../shared/api/generatedClient'

const version: AgentVersionModel = {
  id: 'version-id', agentId: 'investment-id', semver: '1.0.0', status: 'ACTIVE', endpoint: 'http://localhost:8090',
  priceAtomic: '1000000', priceLabel: '1 USDC', network: 'eip155:84532', asset: 'USDC', payTo: '0x1', createdAt: '', updatedAt: '',
}

const quote: QuoteResponse = {
  id: 'quote-id', rootVersionId: version.id, expiresAt: '2099-01-01T00:05:00.000Z', maxCostAtomic: '2500000',
  snapshot: {
    version: { id: version.id, agentId: version.agentId, agentCode: 'investment', semver: version.semver, endpoint: version.endpoint, priceAtomic: version.priceAtomic, network: version.network, asset: version.asset, payTo: version.payTo, responseFormat: 'JSON' },
    dependencies: [{ dependencyId: 'dependency-id', targetAgentId: 'risk-id', targetAgentCode: 'risk', versionConstraint: '>=1.0.0,<2.0.0', required: false, maxPriceAtomic: '1500000', maxCalls: 1 }],
  },
  warnings: [{ code: 'OPTIONAL_DEPENDENCY_NOT_RESOLVED', dependencyId: 'dependency-id', targetAgentId: 'risk-id', targetAgentCode: 'risk', versionConstraint: '>=1.0.0,<2.0.0' }],
}

interface QuoteFixture {
  server: Server
  baseUrl: string
  quoteCalls: number
  executionCalls: number
  receivedExecution?: Record<string, unknown>
  failFirstQuote: boolean
  close: () => Promise<void>
}

async function createQuoteFixture(): Promise<QuoteFixture> {
  let quoteCalls = 0
  let executionCalls = 0
  let receivedExecution: Record<string, unknown> | undefined
  let failFirstQuote = false
  const write = (response: ServerResponse, status: number, result: unknown, message = 'ok') => {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ isSuccess: status < 400, message, result }))
  }
  const handler = async (request: IncomingMessage, response: ServerResponse) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    if (request.method === 'POST' && path === '/api/agents/investment/quotes') {
      quoteCalls += 1
      if (failFirstQuote && quoteCalls === 1) {
        write(response, 503, null, 'quote unavailable')
        return
      }
      write(response, 200, quote)
      return
    }
    if (request.method === 'POST' && path === '/api/executions') {
      executionCalls += 1
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(Buffer.from(chunk))
      receivedExecution = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>
      write(response, 200, { id: 'execution-id', quoteId: quote.id, status: 'PENDING', maxBudgetAtomic: quote.maxCostAtomic, reservedCostAtomic: '0', actualCostAtomic: '0', steps: [], createdAt: '', updatedAt: '' })
      return
    }
    write(response, 404, null, 'not found')
  }
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('fixture did not bind')
  const fixture: QuoteFixture = {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    get quoteCalls() { return quoteCalls },
    get executionCalls() { return executionCalls },
    get receivedExecution() { return receivedExecution },
    get failFirstQuote() { return failFirstQuote },
    set failFirstQuote(value: boolean) { failFirstQuote = value },
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  }
  return fixture
}

function renderPanel(baseUrl: string) {
  agentStoreClient.setConfig({ baseUrl, headers: { Accept: 'application/json' } })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><QuotePanel code="investment" version={version} /></MemoryRouter></QueryClientProvider>)
}

afterEach(() => {
  cleanup()
  agentStoreClient.setConfig({ baseUrl: 'http://localhost:8080', headers: { Accept: 'application/json' } })
})

describe('QuotePanel', () => {
  it('issues a real HTTP quote and renders maximum cost, warning, and graph', async () => {
    const fixture = await createQuoteFixture()
    try {
      renderPanel(fixture.baseUrl)
      fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
      expect((await screen.findAllByText('2.5 USDC')).length).toBeGreaterThan(0)
      expect(screen.getByRole('note')).toHaveTextContent('risk')
      expect(screen.getByRole('heading', { name: 'Quoted dependency graph' })).toBeInTheDocument()
      expect(fixture.quoteCalls).toBe(1)
    } finally {
      await fixture.close()
    }
  })

  it('retries a failed real HTTP quote through the visible retry action', async () => {
    const fixture = await createQuoteFixture()
    fixture.failFirstQuote = true
    try {
      renderPanel(fixture.baseUrl)
      fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('quote unavailable'))
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
      await screen.findByText('quote-id')
      expect(fixture.quoteCalls).toBe(2)
    } finally {
      await fixture.close()
    }
  })

  it('sends the exact quoted maximum budget only after question and approval', async () => {
    const fixture = await createQuoteFixture()
    try {
      renderPanel(fixture.baseUrl)
      fireEvent.click(screen.getByRole('button', { name: 'Quote 발급' }))
      const executeButton = await screen.findByRole('button', { name: 'Maximum Cost 승인 후 실행' })
      fireEvent.change(screen.getByLabelText('Agent에게 물어볼 질문'), { target: { value: ' 시장 위험은? ' } })
      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(executeButton)
      await waitFor(() => expect(fixture.executionCalls).toBe(1))
      expect(fixture.receivedExecution).toEqual({ quoteId: 'quote-id', maxBudgetAtomic: '2500000', question: '시장 위험은?' })
    } finally {
      await fixture.close()
    }
  })
})
