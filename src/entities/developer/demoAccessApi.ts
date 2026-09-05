import { postApiDemoAccess, type DemoAccessResponse } from '../../generated'
import { normalizeApiRequestError, unwrapCommonResponse } from '../../shared/api/client'
import { agentStoreClient } from '../../shared/api/generatedClient'
import { demoAccessGeneration, type DemoAccess } from '../../shared/auth/demoAccess'

export async function requestDemoAccess(signal?: AbortSignal): Promise<DemoAccess> {
  const generation = demoAccessGeneration()
  if (signal?.aborted) throw new DOMException('Demo access request was aborted', 'AbortError')
  try {
    const response = await postApiDemoAccess({ client: agentStoreClient, throwOnError: true, signal })
    if (signal?.aborted) throw new DOMException('Demo access request was aborted', 'AbortError')
    if (generation !== demoAccessGeneration()) throw new DOMException('Demo access was ended', 'AbortError')
    return unwrapCommonResponse<DemoAccessResponse>(response.data)
  } catch (error: unknown) {
    throw normalizeApiRequestError(error)
  }
}
