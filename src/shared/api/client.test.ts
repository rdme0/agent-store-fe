import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError, normalizeApiRequestError, request } from './client'

describe('API transport client', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('resolves a relative path against the configured API base URL', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    )

    await expect(request<{ status: string }>('/health')).resolves.toEqual({
      status: 'ok',
    })
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/health', {
      headers: { Accept: 'application/json' },
    })
  })

  it('surfaces a typed error for non-success responses', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }))

    const result = request('/health')

    await expect(result).rejects.toBeInstanceOf(ApiRequestError)
    await expect(result).rejects.toMatchObject({ status: 503 })
  })

  it('returns undefined for a successful 204 response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(request<void>('/health')).resolves.toBeUndefined()
  })

  it('preserves CommonResponse errors and the HTTP status', () => {
    const error = normalizeApiRequestError(
      {
        isSuccess: false,
        errorCode: 'AGENT_404_002',
        message: 'Agent를 찾을 수 없습니다.',
        result: null,
      },
      { status: 404 },
    )

    expect(error).toMatchObject({
      errorCode: 'AGENT_404_002',
      message: 'Agent를 찾을 수 없습니다.',
      status: 404,
    })
  })

  it('reads the Spring CommonResponse error code and trace header', () => {
    const error = normalizeApiRequestError(
      { isSuccess: false, message: 'Agent를 찾을 수 없습니다.', errorCode: 'AGENT_404_002', result: null },
      { status: 404, headers: new Headers({ 'X-Trace-Id': 'trace-header' }) },
    )

    expect(error).toMatchObject({
      errorCode: 'AGENT_404_002',
      message: 'Agent를 찾을 수 없습니다.',
      status: 404,
      traceId: 'trace-header',
    })
  })
})
