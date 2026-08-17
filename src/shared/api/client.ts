import { API_BASE_URL } from '../config/env'

export class ApiRequestError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: unknown
  readonly traceId?: string

  constructor(
    message: string,
    status: number,
    options: { code?: string; details?: unknown; traceId?: string } = {},
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = options.code
    this.details = options.details
    this.traceId = options.traceId
  }
}

interface ApiErrorBody {
  code?: unknown
  details?: unknown
  message?: unknown
}

interface ApiErrorCandidate {
  code?: unknown
  details?: unknown
  error?: ApiErrorBody
  message?: unknown
  response?: { status?: unknown }
  status?: unknown
  traceId?: unknown
}

export function normalizeApiRequestError(
  error: unknown,
  response?: { status?: number },
): ApiRequestError {
  if (error instanceof ApiRequestError) {
    return error
  }

  const candidate = (typeof error === 'object' && error !== null ? error : {}) as ApiErrorCandidate
  const body = candidate.error
  const status =
    typeof candidate.status === 'number'
      ? candidate.status
      : typeof candidate.response?.status === 'number'
        ? candidate.response.status
        : response?.status ?? 0
  const message =
    typeof body?.message === 'string'
      ? body.message
      : typeof candidate.message === 'string'
        ? candidate.message
        : typeof error === 'string'
          ? error
          : 'AgentStore API 요청에 실패했습니다.'
  const code =
    typeof body?.code === 'string'
      ? body.code
      : typeof candidate.code === 'string'
        ? candidate.code
        : undefined
  const details = body?.details ?? candidate.details
  const traceId = typeof candidate.traceId === 'string' ? candidate.traceId : undefined
  return new ApiRequestError(message, status, { code, details, traceId })
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  return `${API_BASE_URL}/${path.replace(/^\/+/, '')}`
}

/**
 * Transport-only client for future generated API operations.
 * Endpoint contracts belong in the generated client once OpenAPI is available.
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(resolveUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw new ApiRequestError(
      `API request failed with status ${response.status}`,
      response.status,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
