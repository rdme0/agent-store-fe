import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAgentQuote, createDependency, listDependencies, removeDependency, updateDependency } from './api'

describe('Dependency API boundary', () => {
  const fetchMock = vi.fn()

  beforeEach(() => vi.stubGlobal('fetch', fetchMock))
  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('uses generated dependency operations and preserves atomic strings', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ isSuccess: true, message: '요청이 성공했습니다.', errorCode: null, result: [{
      id: 'dependency-id',
      sourceVersionId: 'version-id',
      targetAgentId: 'target-id',
      targetAgentSlug: 'risk-agent',
      versionConstraint: '^1.0.0',
      required: false,
      maxPriceAtomic: '1000001',
      maxCalls: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }]}), { headers: { 'Content-Type': 'application/json' }, status: 200 }))

    const result = await listDependencies('version-id')
    const request = fetchMock.mock.calls[0]?.[0] as Request
    expect(request.url).toBe('http://localhost:8080/api/agent-versions/version-id/dependencies')
    expect(result[0]).toMatchObject({ maxPriceAtomic: '1000001', maxPriceLabel: '1.000001 USDC' })
  })

  it('maps create, update, delete, and quote operations to contract paths', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ isSuccess: true, message: '요청이 성공했습니다.', errorCode: null, result: { id: 'd', sourceVersionId: 'v', targetAgentId: 'a', targetAgentSlug: 'risk', versionConstraint: '^1', required: true, maxPriceAtomic: '1', maxCalls: 1, createdAt: '', updatedAt: '' } }), { headers: { 'Content-Type': 'application/json' }, status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ isSuccess: true, message: '요청이 성공했습니다.', errorCode: null, result: { id: 'd', sourceVersionId: 'v', targetAgentId: 'a', targetAgentSlug: 'risk', versionConstraint: '^2', required: false, maxPriceAtomic: '2', maxCalls: 2, createdAt: '', updatedAt: '' } }), { headers: { 'Content-Type': 'application/json' }, status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ isSuccess: true, message: '요청이 성공했습니다.', errorCode: null, result: { id: 'q', rootVersionId: 'v', expiresAt: '2026-01-01T00:05:00.000Z', maxCostAtomic: '1000000', snapshot: { version: { id: 'v', agentId: 'a', agentSlug: 'investment', semver: '1.0.0', endpoint: 'http://localhost:8090', priceAtomic: '1000000', network: 'eip155:84532', asset: 'USDC', payTo: '0x1' }, dependencies: [] }, warnings: [] } }), { headers: { 'Content-Type': 'application/json' }, status: 201 }))

    await createDependency('v', { targetAgentId: 'a', versionConstraint: '^1', maxPriceAtomic: '1' })
    await updateDependency('v', 'd', { versionConstraint: '^2', maxPriceAtomic: '2', maxCalls: 2 })
    await removeDependency('v', 'd')
    const quote = await createAgentQuote('investment', { versionConstraint: '^1.0.0' })

    expect((fetchMock.mock.calls[0]?.[0] as Request).url).toContain('/api/agent-versions/v/dependencies')
    expect((fetchMock.mock.calls[1]?.[0] as Request).url).toContain('/api/agent-versions/v/dependencies/d')
    expect((fetchMock.mock.calls[2]?.[0] as Request).url).toContain('/api/agent-versions/v/dependencies/d')
    expect((fetchMock.mock.calls[3]?.[0] as Request).url).toBe('http://localhost:8080/api/agents/investment/quotes')
    expect(quote.maxCostLabel).toBe('1 USDC')
  })
})
