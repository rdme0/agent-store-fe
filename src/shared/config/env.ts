const DEFAULT_API_BASE_URL = 'http://localhost:8080'

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
)

export const env = {
  apiBaseUrl: API_BASE_URL,
} as const
