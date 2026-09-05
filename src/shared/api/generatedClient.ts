import { client } from '../../generated/client.gen'
import { normalizeApiRequestError } from './client'
import { clearDemoAccess, currentDemoAccess } from '../auth/demoAccess'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8080'

client.setConfig({
  baseUrl: apiBaseUrl,
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

client.interceptors.error.use((error, response) => {
  if (response?.status === 401) clearDemoAccess()
  return normalizeApiRequestError(error, response)
})

export { client as agentStoreClient }
