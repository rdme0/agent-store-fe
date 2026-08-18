import { describe, expect, it } from 'vitest'
import { baseSepoliaExplorerUrl, paymentFailureMessage, paymentModeLabel } from './paymentPresentation'

describe('payment presentation', () => {
  it('only links a complete transaction hash to the Base Sepolia explorer', () => {
    const hash = `0x${'a'.repeat(64)}`
    expect(baseSepoliaExplorerUrl(hash)).toBe(`https://sepolia.basescan.org/tx/${hash}`)
    expect(baseSepoliaExplorerUrl('payment-attempt-42')).toBeUndefined()
    expect(baseSepoliaExplorerUrl('0xabc')).toBeUndefined()
  })

  it('uses distinct Korean labels for supported payment modes and failures', () => {
    expect(paymentModeLabel('simulated')).toContain('simulated')
    expect(paymentModeLabel('x402')).toContain('x402')
    expect(paymentFailureMessage('PRICE_MISMATCH')).toContain('quote')
    expect(paymentFailureMessage('INSUFFICIENT_FUNDS')).toContain('잔액')
    expect(paymentFailureMessage('FACILITATOR_ERROR')).toContain('facilitator')
    expect(paymentFailureMessage('FAILED_AFTER_PAYMENT')).toContain('결제는 완료')
    expect(paymentFailureMessage('PAYMENT_RECONCILIATION_REQUIRED')).toContain('중복 결제')
  })
})
