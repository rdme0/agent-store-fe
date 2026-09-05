import {
  getApiDeveloperAgents,
  getApiDeveloperMe,
  getApiDeveloperRevenue,
  type AgentResponse,
  type DemoDeveloperResponse,
  type DeveloperRevenueResponse,
  type GetApiDeveloperRevenueData,
} from '../../generated'
import { normalizeApiRequestError, unwrapCommonResponse } from '../../shared/api/client'
import { agentStoreClient } from '../../shared/api/generatedClient'
import { toAgentModel, type AgentModel } from '../agent/model'

export type { DeveloperRevenueResponse }
export type RevenueQuery = NonNullable<GetApiDeveloperRevenueData['query']>

async function withApiError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw normalizeApiRequestError(error)
  }
}

export function getDemoDeveloper(): Promise<DemoDeveloperResponse> {
  return withApiError(async () => {
    const response = await getApiDeveloperMe({ client: agentStoreClient, throwOnError: true })
    return unwrapCommonResponse<DemoDeveloperResponse>(response.data)
  })
}

export function getDemoDeveloperAgents(): Promise<AgentModel[]> {
  return withApiError(async () => {
    const response = await getApiDeveloperAgents({ client: agentStoreClient, throwOnError: true })
    return unwrapCommonResponse<AgentResponse[]>(response.data).map(toAgentModel)
  })
}

export function getDemoDeveloperRevenue(query?: RevenueQuery): Promise<DeveloperRevenueResponse> {
  return withApiError(async () => {
    const response = await getApiDeveloperRevenue({
      client: agentStoreClient,
      throwOnError: true,
      query: { limit: query?.limit ?? 20, cursor: query?.cursor },
    })
    return unwrapCommonResponse<DeveloperRevenueResponse>(response.data)
  })
}
