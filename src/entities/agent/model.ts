import type { AgentListResponse, AgentResponse, AgentVersionResponse } from '../../generated'

export type AgentResponseFormat = AgentVersionResponse['responseFormat']
export type AgentVersionDto = Omit<AgentVersionResponse, 'responseFormat'> & { responseFormat?: AgentResponseFormat }
export type AgentDto = Omit<AgentResponse, 'versions' | 'usageType'> & { usageType?: AgentResponse['usageType']; versions: AgentVersionDto[] }
export type AgentListItemDto = Omit<AgentListResponse['items'][number], 'versions' | 'usageType'> & { usageType?: AgentResponse['usageType']; versions: AgentVersionDto[] }
export type AgentDetailDto = AgentDto
export type AgentVersionStatus = AgentVersionDto['status']

export const RESPONSE_FORMAT_OPTIONS: Array<{ value: AgentResponseFormat; label: string; description: string }> = [
  { value: 'TEXT', label: '일반 문장', description: '문장과 줄바꿈으로 결과를 표시합니다.' },
  { value: 'MARKDOWN', label: 'Markdown', description: '제목·목록·강조가 있는 문서로 표시합니다.' },
  { value: 'STRUCTURED', label: '구조화 결과', description: '제목·요약·섹션 카드로 표시합니다.' },
  { value: 'JSON', label: 'JSON', description: '자유로운 JSON을 안전한 보기로 표시합니다.' },
]

export interface AgentVersionModel extends Omit<AgentVersionDto, 'responseFormat'> {
  responseFormat?: AgentResponseFormat
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
      responseFormat: version.responseFormat ?? 'JSON',
      priceLabel: formatAtomicUsdc(version.priceAtomic),
    })),
  }
}

export function toVersionModel(dto: AgentVersionDto): AgentVersionModel {
  return { ...dto, responseFormat: dto.responseFormat ?? 'JSON', priceLabel: formatAtomicUsdc(dto.priceAtomic) }
}

export function getActiveVersion(agent: AgentModel): AgentVersionModel | undefined {
  return agent.versions.find((version) => version.status === 'ACTIVE')
}
