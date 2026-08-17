import { client } from '../../generated/client.gen'
import { API_BASE_URL } from '../config/env'
import { normalizeApiRequestError } from './client'

client.setConfig({
  baseUrl: API_BASE_URL,
  headers: { Accept: 'application/json' },
})

client.interceptors.error.use((error, response) => normalizeApiRequestError(error, response))

export { client as agentStoreClient }
