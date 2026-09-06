import { client } from '../../generated/client.gen'
import { normalizeApiRequestError } from './client'
import { clearDemoAccess, currentDemoAccess } from '../auth/demoAccess'
import { API_BASE_URL } from '../config/apiBaseUrl'

client.setConfig({
  baseUrl: API_BASE_URL,
  headers: { Accept: 'application/json' },
})

client.interceptors.request.use((request) => {
  const headers = new Headers(request.headers)
  if (request.url.includes('/api/executions/') && request.url.endsWith('/events')) {
    headers.set('Accept', 'text/event-stream')
  }
  const access = currentDemoAccess()
  if (access) headers.set('Authorization', `Bearer ${access.accessToken}`)
  return new Request(request, { headers })
})

client.interceptors.error.use((error, response, request) => {
  const access = currentDemoAccess()
  if (response?.status === 401 && access && request?.headers.get('Authorization') === `Bearer ${access.accessToken}`) clearDemoAccess('unauthorized')
  return normalizeApiRequestError(error, response)
})

export { client as agentStoreClient }
