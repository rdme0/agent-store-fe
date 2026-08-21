import { describe, expect, it } from 'vitest'
import { formatAtomicUsdc, toAgentModel } from './model'

describe('Agent UI mapping', () => {
  it('formats atomic USDC without floating point arithmetic', () => {
    expect(formatAtomicUsdc('10000')).toBe('0.01 USDC')
    expect(formatAtomicUsdc('1000000')).toBe('1 USDC')
    expect(formatAtomicUsdc('1000001')).toBe('1.000001 USDC')
  })

  it('maps API DTO versions and derives a display price', () => {
    const result = toAgentModel({
      id: 'agent-id',
      developerId: 'developer-id',
      developerName: 'Demo Developer',
      slug: 'demo-agent',
      name: 'Demo Agent',
      description: 'Fixture',
      dependencyCount: 3,
      versions: [{
        id: 'version-id',
        agentId: 'agent-id',
        semver: '1.0.0',
        status: 'ACTIVE',
        endpoint: 'http://localhost:8090/agent',
        priceAtomic: '2500000',
        network: 'eip155:84532',
        asset: 'USDC',
        payTo: '0x1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(result.versions[0].priceLabel).toBe('2.5 USDC')
    expect(result.dependencyCount).toBe(3)
  })
})
