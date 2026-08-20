import { formatAtomicUsdc } from '../agent/model'
import type { DependencyResponse, QuoteResponse, QuoteSnapshot } from '../../generated'

export type DependencyDto = DependencyResponse
export type QuoteDto = QuoteResponse
export type { QuoteSnapshot }

export interface DependencyModel extends DependencyDto {
  maxPriceLabel: string
}

export interface QuoteModel extends QuoteDto {
  maxCostLabel: string
}

export function toDependencyModel(dto: DependencyDto): DependencyModel {
  return {
    ...dto,
    maxPriceLabel: formatAtomicUsdc(dto.maxPriceAtomic),
  }
}

export function toQuoteModel(dto: QuoteDto): QuoteModel {
  return {
    ...dto,
    maxCostLabel: formatAtomicUsdc(dto.maxCostAtomic),
  }
}
