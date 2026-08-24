import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { importAgentManifest, validateAgentManifest } from '../entities/agent-manifest/api'
import { AgentManifestPage } from './AgentManifestPage'

vi.mock('../entities/agent-manifest/api', () => ({
  importAgentManifest: vi.fn(),
  validateAgentManifest: vi.fn(),
}))
vi.mock('../shared/config/env', () => ({
  DEMO_DEVELOPER_ID: '123e4567-e89b-12d3-a456-426614174000',
}))

const importAgentManifestMock = vi.mocked(importAgentManifest)
const validateAgentManifestMock = vi.mocked(validateAgentManifest)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={queryClient}><MemoryRouter><AgentManifestPage /></MemoryRouter></QueryClientProvider>)
  return queryClient
}

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('AgentManifestPage', () => {
  it('keeps the import action disabled when manifest validation fails', async () => {
    validateAgentManifestMock.mockRejectedValue(new Error('YAML 형식 오류'))
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: '선언 검증' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('YAML 형식 오류')
    expect(screen.getByRole('button', { name: 'DRAFT Agent 등록' })).toBeDisabled()
  })

  it('ignores a validation response after the YAML content has changed', async () => {
    let resolveValidation: ((value: { agentCode: string; functionCode: string; canonicalContent: string; sha256: string }) => void) | undefined
    validateAgentManifestMock.mockImplementation(() => new Promise((resolve) => {
      resolveValidation = resolve
    }))
    renderPage()

    const editor = screen.getByLabelText('YAML 매니페스트')
    fireEvent.click(screen.getByRole('button', { name: '선언 검증' }))
    fireEvent.change(editor, { target: { value: 'apiVersion: agentstore/v1\nagent: changed' } })
    resolveValidation?.({ agentCode: 'old-agent', functionCode: 'old-function', canonicalContent: '', sha256: 'old-hash' })

    await waitFor(() => expect(validateAgentManifestMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('old-hash')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'DRAFT Agent 등록' })).toBeDisabled()
  })

  it('coalesces same-tick validation clicks before pending state renders', async () => {
    validateAgentManifestMock.mockImplementation(() => new Promise(() => undefined))
    renderPage()

    const button = screen.getByRole('button', { name: '선언 검증' })
    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => expect(validateAgentManifestMock).toHaveBeenCalledTimes(1))
  })

  it('imports only the current validated manifest and invalidates Agent queries', async () => {
    validateAgentManifestMock.mockResolvedValue({
      agentCode: 'example-agent',
      functionCode: 'example-function',
      canonicalContent: 'canonical',
      sha256: 'hash',
    })
    importAgentManifestMock.mockResolvedValue({
      agentId: 'agent-id',
      versionId: 'version-id',
      agentCode: 'example-agent',
      sha256: 'hash',
    })
    const queryClient = renderPage()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)

    fireEvent.click(screen.getByRole('button', { name: '선언 검증' }))
    expect(await screen.findByText('선언 해시:')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'DRAFT Agent 등록' }))

    await waitFor(() => expect(importAgentManifestMock).toHaveBeenCalledTimes(1))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['agents'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['marketplace-agents'] })
  })
})
