import { postApiDemoAccess, type DemoAccessResponse } from '../../generated'
import { normalizeApiRequestError, unwrapCommonResponse } from '../../shared/api/client'
import { agentStoreClient } from '../../shared/api/generatedClient'
import { type DemoAccess } from '../../shared/auth/demoAccess'

export async function requestDemoAccess(signal?: AbortSignal): Promise<DemoAccess> {
  if (signal?.aborted) throw new DOMException('Demo access request was aborted', 'AbortError')
  try {
    const response = await postApiDemoAccess({ client: agentStoreClient, throwOnError: true, signal })
    if (signal?.aborted) throw new DOMException('Demo access request was aborted', 'AbortError')
    return unwrapCommonResponse<DemoAccessResponse>(response.data)
  } catch (error: unknown) {
    throw normalizeApiRequestError(error)
  }
}
