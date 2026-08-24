import {
  getApiFunctionContracts,
  getApiFunctionContractsByIdProviders,
  postApiFunctionContracts,
  type FunctionContractResponse,
  type FunctionProviderMetricResponse,
  type PostApiFunctionContractsData,
} from '../../generated'
import { normalizeApiRequestError, unwrapCommonResponse } from '../../shared/api/client'
import { agentStoreClient } from '../../shared/api/generatedClient'

export type CreateFunctionContractInput = PostApiFunctionContractsData['body']

async function withApiError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw normalizeApiRequestError(error)
  }
}

export function listFunctionContracts(): Promise<FunctionContractResponse[]> {
  return withApiError(async () => {
    const response = await getApiFunctionContracts({
      client: agentStoreClient,
      throwOnError: true,
    })
    return unwrapCommonResponse<FunctionContractResponse[]>(response.data)
  })
}

export function listFunctionProviders(id: string): Promise<FunctionProviderMetricResponse[]> {
  return withApiError(async () => {
    const response = await getApiFunctionContractsByIdProviders({
      client: agentStoreClient,
      path: { id },
      throwOnError: true,
    })
    return unwrapCommonResponse<FunctionProviderMetricResponse[]>(response.data)
  })
}

export function createFunctionContract(input: CreateFunctionContractInput): Promise<FunctionContractResponse> {
  return withApiError(async () => {
    const response = await postApiFunctionContracts({
      client: agentStoreClient,
      body: input,
      throwOnError: true,
    })
    return unwrapCommonResponse<FunctionContractResponse>(response.data)
  })
}
