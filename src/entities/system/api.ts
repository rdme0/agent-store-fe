import { getHealth, type HealthResponse } from '../../generated'
import { normalizeApiRequestError, unwrapCommonResponse } from '../../shared/api/client'
import { agentStoreClient } from '../../shared/api/generatedClient'

export async function getApiHealth(): Promise<HealthResponse> {
  try {
    const response = await getHealth({
      client: agentStoreClient,
      throwOnError: true,
    })
    return unwrapCommonResponse<HealthResponse>(response.data)
  } catch (error) {
    throw normalizeApiRequestError(error)
  }
}
