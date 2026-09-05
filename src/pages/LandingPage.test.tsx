/// <reference types="node" />

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { DisplayModeProvider } from '../app/DisplayModeContext'
import { LandingPage } from './LandingPage'
import { agentStoreClient } from '../shared/api/generatedClient'
import { clearDemoAccess } from '../shared/auth/demoAccess'

describe('LandingPage demo access', () => {
  let server: Server
  let port = 0
  let requests = 0
  let closedResponses = 0
  let mode: 'success' | 'failure' | 'hold' = 'success'
  let release: (() => void) | undefined

  beforeEach(async () => {
    window.localStorage.clear()
    requests = 0
    closedResponses = 0
    mode = 'success'
    release = undefined
    server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
      if (request.method !== 'POST' || request.url !== '/api/demo/access') {
        response.writeHead(404)
        response.end()
        return
      }
      requests += 1
      response.on('close', () => { closedResponses += 1 })
      await readBody(request)
      if (mode === 'hold') {
        await new Promise<void>((resolve) => { release = resolve })
      }
      if (mode === 'failure' && requests === 1) {
        write(response, 503, { isSuccess: false, message: '발급 서비스를 사용할 수 없습니다.', errorCode: 'COMMON_503_001', result: null })
        return
      }
      write(response, 200, {
        isSuccess: true,
        message: 'success',
        errorCode: null,
        result: { accessToken: 'landing-fixture-access', expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() },
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as { port: number }).port
    agentStoreClient.setConfig({ baseUrl: `http://127.0.0.1:${port}`, headers: { Accept: 'application/json' } })
  })

  afterEach(async () => {
    cleanup()
    clearDemoAccess()
    agentStoreClient.setConfig({ baseUrl: 'http://localhost:8080', headers: { Accept: 'application/json' } })
    await new Promise<void>((resolve, reject) => server.close((error: Error | undefined) => error ? reject(error) : resolve()))
  })

  it('sends only one access request for duplicate clicks', async () => {
    mode = 'hold'
    const { router } = renderLanding()
    const button = screen.getByRole('button', { name: /데모 시작/ })

    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => expect(requests).toBe(1))
    expect(button).toBeDisabled()
    release?.()
    await waitFor(() => expect(screen.getByText('Marketplace')).toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/marketplace')
    await waitFor(() => expect(window.localStorage.getItem('agentstore.display-mode')).toBe('developer'))
  })

  it('shows the error and allows a failed access request to be retried', async () => {
    mode = 'failure'
    renderLanding()
    const button = screen.getByRole('button', { name: /데모 시작/ })

    fireEvent.click(button)

    await waitFor(() => expect(screen.getByText('발급 서비스를 사용할 수 없습니다.')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /데모 시작/ }))
    await waitFor(() => expect(screen.getByText('Marketplace')).toBeInTheDocument())
    expect(requests).toBe(2)
  })

  it('reuses a valid access record and restores developer mode without another request', async () => {
    window.localStorage.setItem('agentstore.demo-access', JSON.stringify({ accessToken: 'stored-access', expiresAt: new Date(Date.now() + 60_000).toISOString() }))
    const { router } = renderLanding()

    fireEvent.click(screen.getByRole('button', { name: /데모 시작/ }))

    await waitFor(() => expect(screen.getByText('Marketplace')).toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/marketplace')
    expect(requests).toBe(0)
    await waitFor(() => expect(window.localStorage.getItem('agentstore.display-mode')).toBe('developer'))
  })

  it('aborts an in-flight access request when the landing page unmounts', async () => {
    mode = 'hold'
    const { view } = renderLanding()
    fireEvent.click(screen.getByRole('button', { name: /데모 시작/ }))

    await waitFor(() => expect(requests).toBe(1))
    view.unmount()
    await waitFor(() => expect(closedResponses).toBe(1))
  })
})

function renderLanding() {
  const router = createMemoryRouter([
    { path: '/', element: <LandingPage /> },
    { path: '/marketplace', element: <p>Marketplace</p> },
    { path: '/developer/revenue', element: <p>Dashboard</p> },
  ], { initialEntries: ['/'] })
  const view = render(<DisplayModeProvider><RouterProvider router={router} /></DisplayModeProvider>)
  return { router, view }
}

function write(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}
