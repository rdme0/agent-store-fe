import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError, request } from './client'

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
})
