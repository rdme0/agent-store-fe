const DEFAULT_API_BASE_URL = 'http://localhost:8080'

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
)

export const DEMO_DEVELOPER_ID = import.meta.env.VITE_DEMO_DEVELOPER_ID?.trim() || ''

export const env = {
  apiBaseUrl: API_BASE_URL,
  demoDeveloperId: DEMO_DEVELOPER_ID,
} as const
