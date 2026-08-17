import type {
  GetApiAgentsBySlugResponse,
  GetApiAgentsResponse,
} from '../../generated'

export type AgentDto = GetApiAgentsBySlugResponse
export type AgentListItemDto = GetApiAgentsResponse['items'][number]
export type AgentDetailDto = GetApiAgentsBySlugResponse
export type AgentVersionDto = AgentDto['versions'][number]
export type AgentVersionStatus = AgentVersionDto['status']

export interface AgentVersionModel extends AgentVersionDto {
  priceLabel: string
}

export interface AgentModel extends Omit<AgentDto, 'versions'> {
  versions: AgentVersionModel[]
}

export function formatAtomicUsdc(priceAtomic: string): string {
  const normalized = priceAtomic.replace(/^0+(?=\d)/, '')
  const whole = normalized.slice(0, -6) || '0'
  const fraction = normalized.slice(-6).padStart(6, '0').replace(/0+$/, '')
  return fraction.length > 0 ? `${whole}.${fraction} USDC` : `${whole} USDC`
}

export function toAgentModel(dto: AgentDto | AgentListItemDto): AgentModel {
  return {
    ...dto,
    versions: dto.versions.map((version) => ({
      ...version,
      priceLabel: formatAtomicUsdc(version.priceAtomic),
    })),
  }
}

export function toVersionModel(dto: AgentVersionDto): AgentVersionModel {
  return { ...dto, priceLabel: formatAtomicUsdc(dto.priceAtomic) }
}

export function getActiveVersion(agent: AgentModel): AgentVersionModel | undefined {
  return agent.versions.find((version) => version.status === 'ACTIVE')
}
