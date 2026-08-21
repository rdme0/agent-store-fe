import { client } from '../../generated/client.gen'
import { API_BASE_URL } from '../config/env'
import { normalizeApiRequestError } from './client'

client.setConfig({
  baseUrl: API_BASE_URL,
  headers: { Accept: 'application/json' },
})

client.interceptors.request.use((request) => {
  if (!request.url.includes('/api/executions/') || !request.url.endsWith('/events')) return request
  const headers = new Headers(request.headers)
  headers.set('Accept', 'text/event-stream')
  return new Request(request, { headers })
})

client.interceptors.error.use((error, response) => normalizeApiRequestError(error, response))

export { client as agentStoreClient }
