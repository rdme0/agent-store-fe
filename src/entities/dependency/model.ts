import type {
  GetApiAgentVersionsByIdDependenciesResponse,
  PostApiAgentsBySlugQuotesResponse,
} from '../../generated'
import { formatAtomicUsdc } from '../agent/model'

export type DependencyDto = GetApiAgentVersionsByIdDependenciesResponse[number]
export type QuoteDto = PostApiAgentsBySlugQuotesResponse

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
