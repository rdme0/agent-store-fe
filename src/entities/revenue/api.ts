import {
  getApiDevelopersByIdRevenue,
  type GetApiDevelopersByIdRevenueData,
  type GetApiDevelopersByIdRevenueResponse,
} from '../../generated'
import { normalizeApiRequestError } from '../../shared/api/client'
import { agentStoreClient } from '../../shared/api/generatedClient'

export type RevenueDto = GetApiDevelopersByIdRevenueResponse
export type RevenueQuery = GetApiDevelopersByIdRevenueData['query']

export async function getDeveloperRevenue(developerId: string, query?: RevenueQuery): Promise<RevenueDto> {
  try {
    const response = await getApiDevelopersByIdRevenue({
      client: agentStoreClient,
      path: { id: developerId },
      query,
      throwOnError: true,
    })
    return response.data
  } catch (error) {
    throw normalizeApiRequestError(error)
  }
}
