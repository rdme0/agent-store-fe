import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getApiHealth } from '../../entities/system/api'
import { ConnectionStatus } from './ConnectionStatus'

vi.mock('../../entities/system/api', () => ({ getApiHealth: vi.fn() }))

const getApiHealthMock = vi.mocked(getApiHealth)

function renderStatus() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={queryClient}><ConnectionStatus /></QueryClientProvider>)
}

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('ConnectionStatus', () => {
  it('shows a checking state before health responds', () => {
    getApiHealthMock.mockImplementation(() => new Promise(() => {}))
    renderStatus()
    expect(screen.getByRole('status')).toHaveTextContent('연결 확인 중')
  })

  it('shows a connected state after a successful health response', async () => {
    getApiHealthMock.mockResolvedValue({ service: 'agent-store', status: 'UP', timestamp: '2026-08-21T00:00:00Z', version: '0.1.0' })
    renderStatus()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('연결됨'))
  })

  it('shows an offline state after health fails', async () => {
    getApiHealthMock.mockRejectedValue(new Error('network down'))
    renderStatus()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('연결 안 됨'))
  })
})
