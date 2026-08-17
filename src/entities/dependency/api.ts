import {
  deleteApiAgentVersionsByIdDependenciesByDependencyId,
  getApiAgentVersionsByIdDependencies,
  patchApiAgentVersionsByIdDependenciesByDependencyId,
  postApiAgentVersionsByIdDependencies,
  postApiAgentsBySlugQuotes,
  type PatchApiAgentVersionsByIdDependenciesByDependencyIdData,
  type PostApiAgentVersionsByIdDependenciesData,
  type PostApiAgentsBySlugQuotesData,
} from '../../generated'
import { normalizeApiRequestError } from '../../shared/api/client'
import { agentStoreClient } from '../../shared/api/generatedClient'
import { toDependencyModel, toQuoteModel, type DependencyModel, type QuoteModel } from './model'

async function withApiError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw normalizeApiRequestError(error)
  }
}

export type CreateDependencyInput = PostApiAgentVersionsByIdDependenciesData['body']
export type UpdateDependencyInput = PatchApiAgentVersionsByIdDependenciesByDependencyIdData['body']
export type CreateQuoteInput = PostApiAgentsBySlugQuotesData['body']

export function listDependencies(versionId: string): Promise<DependencyModel[]> {
  return withApiError(async () => {
    const response = await getApiAgentVersionsByIdDependencies({
      client: agentStoreClient,
      path: { id: versionId },
      throwOnError: true,
    })
    return response.data.map(toDependencyModel)
  })
}

export function createDependency(
  versionId: string,
  input: CreateDependencyInput,
): Promise<DependencyModel> {
  return withApiError(async () => {
    const response = await postApiAgentVersionsByIdDependencies({
      client: agentStoreClient,
      body: input,
      path: { id: versionId },
      throwOnError: true,
    })
    return toDependencyModel(response.data)
  })
}

export function updateDependency(
  versionId: string,
  dependencyId: string,
  input: UpdateDependencyInput,
): Promise<DependencyModel> {
  return withApiError(async () => {
    const response = await patchApiAgentVersionsByIdDependenciesByDependencyId({
      client: agentStoreClient,
      body: input,
      path: { id: versionId, dependencyId },
      throwOnError: true,
    })
    return toDependencyModel(response.data)
  })
}

export function removeDependency(versionId: string, dependencyId: string): Promise<void> {
  return withApiError(async () => {
    await deleteApiAgentVersionsByIdDependenciesByDependencyId({
      client: agentStoreClient,
      path: { id: versionId, dependencyId },
      throwOnError: true,
    })
  })
}

export function createAgentQuote(slug: string, input: CreateQuoteInput = {}): Promise<QuoteModel> {
  return withApiError(async () => {
    const response = await postApiAgentsBySlugQuotes({
      client: agentStoreClient,
      body: input,
      path: { slug },
      throwOnError: true,
    })
    return toQuoteModel(response.data)
  })
}
