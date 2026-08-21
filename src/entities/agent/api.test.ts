import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listMarketplaceAgents, registerAgent } from './api'

describe('Agent API boundary', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('sends the generated register operation and maps its DTO response', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ isSuccess: true, message: '요청이 성공했습니다.', errorCode: null, result: {
      id: 'agent-id',
      developerId: 'developer-id',
      developerName: 'Demo Developer',
      slug: 'demo-agent',
      name: 'Demo Agent',
      description: 'Fixture',
      dependencyCount: 0,
      versions: [{
        id: 'version-id',
        agentId: 'agent-id',
        semver: '1.0.0',
        status: 'DRAFT',
        endpoint: 'http://localhost:8090/agent',
        priceAtomic: '10000',
        network: 'eip155:84532',
        asset: 'USDC',
        payTo: '0x0000000000000000000000000000000000000001',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }}), { headers: { 'Content-Type': 'application/json' }, status: 201 }))

    const result = await registerAgent({
      developerId: '123e4567-e89b-12d3-a456-426614174000',
      slug: 'demo-agent',
      name: 'Demo Agent',
      description: 'Fixture',
      semver: '1.0.0',
      endpoint: 'http://localhost:8090/agent',
      priceAtomic: '10000',
      network: 'eip155:84532',
      asset: 'USDC',
      payTo: '0x0000000000000000000000000000000000000001',
    })

    const request = fetchMock.mock.calls[0]?.[0] as Request
    expect(request.url).toBe('http://localhost:8080/api/agents')
    expect(request.method).toBe('POST')
    expect(result.versions[0]?.priceLabel).toBe('0.01 USDC')
    await expect(request.json()).resolves.toMatchObject({ slug: 'demo-agent', priceAtomic: '10000', responseFormat: 'JSON' })
    expect(result.versions[0]?.responseFormat).toBe('JSON')
  })

  it('forwards Marketplace criteria through the generated list query and preserves dependencyCount', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ isSuccess: true, message: '요청이 성공했습니다.', errorCode: null, result: {
      items: [{
        id: 'agent-id', developerId: 'developer-id', developerName: 'Demo Developer', slug: 'demo-agent',
        name: 'Demo Agent', description: 'Fixture', dependencyCount: 3, versions: [],
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      }], nextCursor: null,
    }}), { headers: { 'Content-Type': 'application/json' } }))

    const result = await listMarketplaceAgents({ cursor: 'cursor-1', limit: 12, q: 'risk', sort: 'NAME_ASC' })

    const request = fetchMock.mock.calls[0]?.[0] as Request
    expect(request.url).toBe('http://localhost:8080/api/agents?cursor=cursor-1&limit=12&q=risk&sort=NAME_ASC')
    expect(result.items[0]?.dependencyCount).toBe(3)
  })
})
