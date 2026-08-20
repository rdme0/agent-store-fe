import {
  getApiDevelopersByIdRevenue,
  type GetApiDevelopersByIdRevenueData,
  type DeveloperRevenueResponse,
} from '../../generated'
import { normalizeApiRequestError, unwrapCommonResponse } from '../../shared/api/client'
import { agentStoreClient } from '../../shared/api/generatedClient'

export type RevenueDto = DeveloperRevenueResponse
export type RevenueQuery = GetApiDevelopersByIdRevenueData['query']

export async function getDeveloperRevenue(developerId: string, query?: RevenueQuery): Promise<RevenueDto> {
  try {
    const response = await getApiDevelopersByIdRevenue({
      client: agentStoreClient,
      path: { id: developerId },
      query,
      throwOnError: true,
    })
    return unwrapCommonResponse<RevenueDto>(response.data)
  } catch (error) {
    throw normalizeApiRequestError(error)
  }
}
