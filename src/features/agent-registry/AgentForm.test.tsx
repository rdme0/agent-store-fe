import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentForm } from './AgentForm'

vi.mock('../../shared/config/env', () => ({ DEMO_DEVELOPER_ID: '123e4567-e89b-12d3-a456-426614174000' }))

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/Agent 주소/), { target: { value: 'risk-agent' } })
  fireEvent.change(screen.getByLabelText(/Agent 이름/), { target: { value: 'Risk Agent' } })
  fireEvent.change(screen.getByLabelText(/^설명/), { target: { value: 'Fixture risk analysis' } })
  fireEvent.change(screen.getByLabelText(/수익 수령 지갑/), { target: { value: '0x0000000000000000000000000000000000000001' } })
}

describe('AgentForm', () => {
  it('hides the developer identifier and submits a decimal-safe atomic API payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<AgentForm isSubmitting={false} onSubmit={onSubmit} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText(/호출 가격/), { target: { value: '1.234567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agent 등록' }))

    expect(screen.queryByLabelText(/Developer ID/)).not.toBeInTheDocument()
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ priceAtomic: '1234567', responseFormat: 'JSON', semver: '1.0.0' })))
  })

  it('submits the selected response format', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<AgentForm isSubmitting={false} onSubmit={onSubmit} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText(/응답 형식/), { target: { value: 'MARKDOWN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agent 등록' }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ responseFormat: 'MARKDOWN' })))
  })

  it('shows an error summary and moves focus to the first invalid field', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    render(<AgentForm isSubmitting={false} onSubmit={vi.fn().mockResolvedValue(undefined)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Agent 등록' }))

    expect(screen.getByRole('alert')).toHaveTextContent('입력 내용을 확인하세요.')
    expect(screen.getByLabelText(/Agent 주소/)).toHaveFocus()
    expect(scrollIntoView).toHaveBeenCalled()
  })

  it('blocks same-tick duplicate submits until the current request resolves', async () => {
    let resolveRequest: (() => void) | undefined
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { resolveRequest = resolve }))
    render(<AgentForm isSubmitting={false} onSubmit={onSubmit} />)
    fillValidForm()
    const form = screen.getByRole('button', { name: 'Agent 등록' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    resolveRequest?.()
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  })
})

afterEach(() => {
  cleanup()
})
