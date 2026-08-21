import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamExecutionEvents } from './api'

describe('Execution API boundary', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('overrides the JSON Accept header for the SSE endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('event: EXECUTION_RUNNING\nid: 7\ndata: {"status":"RUNNING"}\n\n', {
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const controller = new AbortController()
    await streamExecutionEvents('execution-id', {
      afterEventId: '6',
      onEvent: vi.fn(),
      signal: controller.signal,
    })

    const request = fetchMock.mock.calls[0]?.[0]
    expect(request).toBeInstanceOf(Request)
    expect((request as Request).headers.get('Accept')).toBe('text/event-stream')
    expect((request as Request).headers.get('Last-Event-ID')).toBe('6')
  })
})
