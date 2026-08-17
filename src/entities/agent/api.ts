import {
  getApiAgents,
  getApiAgentsBySlug,
  patchApiAgentsById,
  postApiAgentVersionsByIdDisable,
  postApiAgentVersionsByIdPublish,
  postApiAgents,
  postApiAgentsByIdVersions,
  type GetApiAgentsData,
  type PatchApiAgentsByIdData,
  type PostApiAgentsByIdVersionsData,
  type PostApiAgentsData,
} from '../../generated'
import { normalizeApiRequestError } from '../../shared/api/client'
import { agentStoreClient } from '../../shared/api/generatedClient'
import { toAgentModel, toVersionModel, type AgentModel, type AgentVersionModel } from './model'

async function withApiError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw normalizeApiRequestError(error)
  }
}

export type RegisterAgentInput = PostApiAgentsData['body']
export type CreateVersionInput = PostApiAgentsByIdVersionsData['body']
export type UpdateAgentInput = PatchApiAgentsByIdData['body']

export function listAgents(query?: GetApiAgentsData['query']): Promise<AgentModel[]> {
  return withApiError(async () => {
    const response = await getApiAgents({
      client: agentStoreClient,
      query,
      throwOnError: true,
    })
    return response.data.items.map(toAgentModel)
  })
}

export function getAgentBySlug(slug: string): Promise<AgentModel> {
  return withApiError(async () => {
    const response = await getApiAgentsBySlug({
      client: agentStoreClient,
      path: { slug },
      throwOnError: true,
    })
    return toAgentModel(response.data)
  })
}

export function registerAgent(input: RegisterAgentInput): Promise<AgentModel> {
  return withApiError(async () => {
    const response = await postApiAgents({
      client: agentStoreClient,
      body: input,
      throwOnError: true,
    })
    return toAgentModel(response.data)
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
    return toAgentModel(response.data)
  })
}

export function createAgentVersion(
  agentId: string,
  input: CreateVersionInput,
): Promise<AgentVersionModel> {
  return withApiError(async () => {
    const response = await postApiAgentsByIdVersions({
      client: agentStoreClient,
      body: input,
      path: { id: agentId },
      throwOnError: true,
    })
    return toVersionModel(response.data)
  })
}

export function publishAgentVersion(versionId: string): Promise<AgentVersionModel> {
  return withApiError(async () => {
    const response = await postApiAgentVersionsByIdPublish({
      client: agentStoreClient,
      path: { id: versionId },
      throwOnError: true,
    })
    return toVersionModel(response.data)
  })
}

export function disableAgentVersion(versionId: string): Promise<AgentVersionModel> {
  return withApiError(async () => {
    const response = await postApiAgentVersionsByIdDisable({
      client: agentStoreClient,
      path: { id: versionId },
      throwOnError: true,
    })
    return toVersionModel(response.data)
  })
}
