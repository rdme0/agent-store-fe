import { describe, expect, it } from 'vitest'
import { usdcToAtomic, validateAgent, validateUsdcAmount, validateVersion } from './validation'

describe('agent registry form validation', () => {
  it('requires a valid atomic price and URL', () => {
    const errors = validateVersion({
      semver: '1.0.0',
      endpoint: 'localhost:8090',
      priceAtomic: '0.01',
      network: 'eip155:84532',
      asset: 'USDC',
      payTo: '0x1',
    })

    expect(errors.endpoint).toContain('http://')
    expect(errors.priceAtomic).toContain('atomic string')
  })

  it('rejects invalid slug and developer identifiers', () => {
    const errors = validateAgent({
      developerId: 'demo',
      slug: 'Demo Agent',
      name: 'Demo',
      description: 'Fixture',
      semver: '1.0.0',
      endpoint: 'http://localhost:8090/agent',
      priceAtomic: '10000',
      network: 'eip155:84532',
      asset: 'USDC',
      payTo: '0x1',
    })

    expect(errors.slug).toBeDefined()
    expect(errors.developerId).toContain('UUID')
  })

  it('converts human-readable USDC to atomic units without floating point arithmetic', () => {
    expect(usdcToAtomic('1.234567')).toBe('1234567')
    expect(usdcToAtomic('0.01')).toBe('10000')
    expect(usdcToAtomic('0002.5')).toBe('2500000')
    expect(usdcToAtomic('0.0000001')).toBeUndefined()
    expect(validateUsdcAmount('0')).toContain('0보다')
  })
})
