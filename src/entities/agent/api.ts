import {
  getApiAgents,
  getApiAgentsByCode,
  patchApiAgentsById,
  postApiAgentVersionsByIdDisable,
  postApiAgentVersionsByIdPublish,
  postApiAgents,
  postApiAgentsByIdVersions,
  type AgentListResponse,
  type AgentResponse,
  type AgentVersionResponse,
  type GetApiAgentsData,
  type PatchApiAgentsByIdData,
  type PostApiAgentsByIdVersionsData,
  type PostApiAgentsData,
} from '../../generated'
import { normalizeApiRequestError, unwrapCommonResponse } from '../../shared/api/client'
import { agentStoreClient } from '../../shared/api/generatedClient'
import { toAgentModel, toVersionModel, type AgentModel, type AgentVersionModel } from './model'

async function withApiError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw normalizeApiRequestError(error)
  }
}

export type RegisterAgentInput = Omit<PostApiAgentsData['body'], 'responseFormat' | 'usageType'> & {
  responseFormat?: import('./model').AgentResponseFormat
  usageType?: 'user_facing' | 'internal_component'
}
export type CreateVersionInput = Omit<PostApiAgentsByIdVersionsData['body'], 'responseFormat'> & {
  responseFormat?: import('./model').AgentResponseFormat
}
export type UpdateAgentInput = PatchApiAgentsByIdData['body']

/**
 * The generated client is refreshed from Spring's OpenAPI document after the database-backed
 * application is available. Keep the handwritten boundary on the new API contract meanwhile.
 */
export interface MarketplaceAgentQuery {
  limit?: number
  cursor?: string
  q?: string
  sort?: 'newest' | 'name_asc'
  usageType?: 'user_facing' | 'internal_component'
}
export type MarketplaceAgentSort = NonNullable<MarketplaceAgentQuery['sort']>

export interface MarketplaceAgentPage {
  items: AgentModel[]
  nextCursor?: string | null
}

export function listAgents(query: MarketplaceAgentQuery = {}): Promise<AgentModel[]> {
  return withApiError(async () => {
    const response = await getApiAgents({
      client: agentStoreClient,
      query: query as NonNullable<GetApiAgentsData['query']>,
      throwOnError: true,
    })
    const data = unwrapCommonResponse<AgentListResponse>(response.data)
    return data.items.map(toAgentModel)
  })
}

export function listMarketplaceAgents(query: MarketplaceAgentQuery = {}): Promise<MarketplaceAgentPage> {
  return withApiError(async () => {
    const response = await getApiAgents({
      client: agentStoreClient,
      query: query as NonNullable<GetApiAgentsData['query']>,
      throwOnError: true,
    })
    const data = unwrapCommonResponse<AgentListResponse>(response.data)
    return {
      items: data.items.map(toAgentModel),
      nextCursor: data.nextCursor,
    }
  })
}

export function getAgentByCode(code: string): Promise<AgentModel> {
  return withApiError(async () => {
    const response = await getApiAgentsByCode({
      client: agentStoreClient,
      path: { code },
      throwOnError: true,
    })
    return toAgentModel(unwrapCommonResponse<AgentResponse>(response.data))
  })
}

export function registerAgent(input: RegisterAgentInput): Promise<AgentModel> {
  return withApiError(async () => {
    const response = await postApiAgents({
      client: agentStoreClient,
      body: { ...input, responseFormat: input.responseFormat ?? 'JSON', usageType: input.usageType ?? 'internal_component' },
      throwOnError: true,
    })
    return toAgentModel(unwrapCommonResponse<AgentResponse>(response.data))
  })
}

export function updateAgent(id: string, input: UpdateAgentInput): Promise<AgentModel> {
  return withApiError(async () => {
    const response = await patchApiAgentsById({
      client: agentStoreClient,
      body: input,
      path: { id },
      throwOnError: true,
    })
    return toAgentModel(unwrapCommonResponse<AgentResponse>(response.data))
  })
}

export function createAgentVersion(
  agentId: string,
  input: CreateVersionInput,
): Promise<AgentVersionModel> {
  return withApiError(async () => {
    const response = await postApiAgentsByIdVersions({
      client: agentStoreClient,
      body: { ...input, responseFormat: input.responseFormat ?? 'JSON' },
      path: { id: agentId },
      throwOnError: true,
    })
    return toVersionModel(unwrapCommonResponse<AgentVersionResponse>(response.data))
  })
}

export function publishAgentVersion(versionId: string): Promise<AgentVersionModel> {
  return withApiError(async () => {
    const response = await postApiAgentVersionsByIdPublish({
      client: agentStoreClient,
      path: { id: versionId },
      throwOnError: true,
    })
    return toVersionModel(unwrapCommonResponse<AgentVersionResponse>(response.data))
  })
}

export function disableAgentVersion(versionId: string): Promise<AgentVersionModel> {
  return withApiError(async () => {
    const response = await postApiAgentVersionsByIdDisable({
      client: agentStoreClient,
      path: { id: versionId },
      throwOnError: true,
    })
    return toVersionModel(unwrapCommonResponse<AgentVersionResponse>(response.data))
  })
}
