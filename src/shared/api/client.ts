import { API_BASE_URL } from '../config/env'

export class ApiRequestError extends Error {
  readonly status: number
  readonly errorCode?: string
  readonly traceId?: string

  constructor(
    message: string,
    status: number,
    options: { errorCode?: string; traceId?: string } = {},
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.errorCode = options.errorCode
    this.traceId = options.traceId
  }
}

interface CommonResponseErrorBody {
  errorCode?: unknown
  message?: unknown
  result?: unknown
}

interface CommonResponseErrorCandidate extends CommonResponseErrorBody {
  errorCode?: unknown
  response?: { status?: unknown }
  status?: unknown
}

export function normalizeApiRequestError(
  error: unknown,
  response?: { status?: number; headers?: Headers },
): ApiRequestError {
  if (error instanceof ApiRequestError) {
    return error
  }

  const body = (typeof error === 'object' && error !== null ? error : {}) as CommonResponseErrorCandidate
  const status =
    typeof body.status === 'number'
      ? body.status
      : typeof body.response?.status === 'number'
        ? body.response.status
        : response?.status ?? 0
  const message =
    typeof body?.message === 'string'
      ? body.message
      : typeof error === 'string'
        ? error
        : 'AgentStore API 요청에 실패했습니다.'
  const errorCode =
    typeof body?.errorCode === 'string'
      ? body.errorCode
      : undefined
  const traceIdFromHeader = response?.headers?.get('X-Trace-Id') ?? null
  return new ApiRequestError(message, status, { errorCode, traceId: traceIdFromHeader ?? undefined })
}

export function unwrapCommonResponse<T>(data: unknown): T {
  const envelope = data as { isSuccess?: boolean; result?: unknown; message?: unknown }
  if (!envelope || envelope.isSuccess === false) {
    throw new ApiRequestError(
      typeof envelope?.message === 'string' ? envelope.message : 'AgentStore API 응답이 올바르지 않습니다.',
      500,
    )
  }
  return envelope.result as T
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
