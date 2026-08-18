export type PaymentMode = 'simulated' | 'x402'

const BASE_SEPOLIA_TRANSACTION_HASH = /^0x[0-9a-fA-F]{64}$/

export function paymentModeLabel(mode: PaymentMode): string {
  return mode === 'x402' ? 'x402 실제 결제 (Base Sepolia)' : 'simulated 결제'
}

/** Only transaction hashes can be linked; arbitrary payment identifiers stay plain text. */
export function baseSepoliaExplorerUrl(transactionHash: string | undefined): string | undefined {
  if (!transactionHash || !BASE_SEPOLIA_TRANSACTION_HASH.test(transactionHash)) return undefined
  return `https://sepolia.basescan.org/tx/${transactionHash}`
}

export function paymentFailureMessage(code: string | undefined): string | undefined {
  switch (code) {
    case 'INSUFFICIENT_FUNDS': return '잔액이 부족하여 결제가 완료되지 않았습니다.'
    case 'FACILITATOR_ERROR': return 'x402 facilitator에서 결제 처리를 완료하지 못했습니다. 잠시 후 다시 확인해 주세요.'
    case 'PRICE_MISMATCH': return '결제 요청 금액이 승인한 quote와 달라 결제하지 않았습니다.'
    case 'FAILED_AFTER_PAYMENT': return '결제는 완료됐지만 Agent 실행이 실패했습니다.'
    case 'PAYMENT_RECONCILIATION_REQUIRED': return '결제 상태를 확인 중입니다. 중복 결제하지 마세요.'
    case 'PAYMENT_LOOKUP_REQUIRED': return '결제 상태를 확인 중입니다. 중복 결제하지 마세요.'
    case 'PAYMENT_NOT_FOUND': return '결제 확인 결과가 없습니다. 다시 실행하기 전에 결제 상태를 확인해 주세요.'
    default: return undefined
  }
}
