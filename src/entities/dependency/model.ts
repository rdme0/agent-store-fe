import { formatAtomicUsdc } from '../agent/model'
import type { DependencyResponse, DependencySnapshotDto, QuoteResponse, QuoteSnapshotDto as GeneratedQuoteSnapshot, ResolvedVersionSnapshotDto } from '../../generated'
import type { AgentResponseFormat } from '../agent/model'

export type DependencyDto = DependencyResponse
export type QuoteDto = QuoteResponse

export type QuoteVersionSnapshot = Omit<ResolvedVersionSnapshotDto, 'responseFormat' | 'agentName' | 'agentDescription'> & {
  agentName?: string | null
  agentDescription?: string | null
  responseFormat?: AgentResponseFormat
}

export type QuoteSnapshot = Omit<GeneratedQuoteSnapshot, 'version' | 'dependencies'> & {
  version: QuoteVersionSnapshot
  dependencies: Array<Omit<DependencySnapshotDto, 'resolved'> & { resolved?: QuoteSnapshot | null }>
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
    snapshot: dto.snapshot as QuoteSnapshot,
    maxCostLabel: formatAtomicUsdc(dto.maxCostAtomic),
  }
}
