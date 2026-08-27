const BASE_SEPOLIA_TRANSACTION_HASH = /^0x[0-9a-fA-F]{64}$/

export function paymentNetworkLabel(): string { return 'x402 실제 결제 (Base Sepolia)' }

/** Only transaction hashes can be linked; arbitrary payment identifiers stay plain text. */
export function baseSepoliaExplorerUrl(transactionHash: string | undefined): string | undefined {
  if (!transactionHash || !BASE_SEPOLIA_TRANSACTION_HASH.test(transactionHash)) return undefined
  return `https://sepolia.basescan.org/tx/${transactionHash}`
}

export function paymentFailureMessage(code: string | undefined): string | undefined {
  switch (code) {
    case 'INSUFFICIENT_FUNDS': return '잔액이 부족하여 결제가 완료되지 않았습니다.'
    case 'FACILITATOR_ERROR': return 'x402 facilitator에서 결제 처리를 완료하지 못했습니다. 잠시 후 다시 확인해 주세요.'
    case 'PRICE_MISMATCH':
    case 'PAYMENT_409_001': return '결제 요청 금액이 승인한 quote와 달라 결제하지 않았습니다.'
    case 'FAILED_AFTER_PAYMENT':
    case 'PAYMENT_502_001': return '결제는 완료됐지만 Agent 실행이 실패했습니다.'
    case 'PAYMENT_FAILED':
    case 'PAYMENT_502_002': return '결제에 실패했습니다.'
    case 'PAYMENT_RECONCILIATION_REQUIRED':
    case 'PAYMENT_503_001': return '결제 상태를 확인 중입니다. 중복 결제하지 마세요.'
    case 'PAYMENT_LOOKUP_REQUIRED': return '결제 상태를 확인 중입니다. 중복 결제하지 마세요.'
    case 'PAYMENT_NOT_FOUND': return '결제 확인 결과가 없습니다. 다시 실행하기 전에 결제 상태를 확인해 주세요.'
    case 'AGENT_TIMEOUT': return 'Agent 응답 시간이 초과되었습니다. 실행 상태를 확인한 뒤 다시 시도해 주세요.'
    case 'EXECUTION_CALLBACK_TIMEOUT': return 'Agent callback 시간이 초과되어 실행이 종료되었습니다.'
    case 'BUDGET_EXCEEDED': return '승인한 Maximum Cost를 초과하므로 실행을 중단했습니다.'
    case 'BUDGET_MISMATCH':
    case 'EXECUTION_422_001': return '승인한 Quote의 Maximum Cost와 요청 금액이 일치하지 않습니다.'
    case 'QUOTE_EXPIRED':
    case 'QUOTE_409_001': return 'Quote가 만료되었습니다. 새 Quote를 발급한 뒤 다시 실행하세요.'
    case 'DEPENDENCY_CYCLE_DETECTED':
    case 'DEPENDENCY_409_003': return '순환 의존성이 감지되어 실행할 수 없습니다.'
    default: return undefined
  }
}
