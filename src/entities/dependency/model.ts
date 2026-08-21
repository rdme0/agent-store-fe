import { formatAtomicUsdc } from '../agent/model'
import type { DependencyResponse, DependencySnapshot, QuoteResponse, QuoteSnapshot as GeneratedQuoteSnapshot, ResolvedVersionSnapshot } from '../../generated'
import type { AgentResponseFormat } from '../agent/model'

export type DependencyDto = DependencyResponse
export type QuoteDto = QuoteResponse

export type QuoteVersionSnapshot = Omit<ResolvedVersionSnapshot, 'responseFormat'> & {
  responseFormat?: AgentResponseFormat
}

export type QuoteSnapshot = Omit<GeneratedQuoteSnapshot, 'version' | 'dependencies'> & {
  version: QuoteVersionSnapshot
  dependencies: Array<Omit<DependencySnapshot, 'resolved'> & { resolved?: QuoteSnapshot | null }>
}

export interface DependencyModel extends DependencyDto {
  maxPriceLabel: string
}

export interface QuoteModel extends Omit<QuoteDto, 'snapshot'> {
  snapshot: QuoteSnapshot
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
