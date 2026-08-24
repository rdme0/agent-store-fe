import {
  postApiAgentManifests,
  postApiAgentManifestsValidate,
  type AgentManifestImportResponse,
  type AgentManifestValidationResponse,
} from '../../generated'
import { normalizeApiRequestError, unwrapCommonResponse } from '../../shared/api/client'
import { agentStoreClient } from '../../shared/api/generatedClient'

async function withApiError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw normalizeApiRequestError(error)
  }
}

export function validateAgentManifest(content: string): Promise<AgentManifestValidationResponse> {
  return withApiError(async () => {
    const response = await postApiAgentManifestsValidate({
      client: agentStoreClient,
      body: { content },
      throwOnError: true,
    })
    return unwrapCommonResponse<AgentManifestValidationResponse>(response.data)
  })
}

export function importAgentManifest(content: string): Promise<AgentManifestImportResponse> {
  return withApiError(async () => {
    const response = await postApiAgentManifests({
      client: agentStoreClient,
      body: { content },
      throwOnError: true,
    })
    return unwrapCommonResponse<AgentManifestImportResponse>(response.data)
  })
}
