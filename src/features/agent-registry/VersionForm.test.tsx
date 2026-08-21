import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VersionForm } from './VersionForm'

afterEach(() => cleanup())

function fillValidVersion() {
  fireEvent.change(screen.getByLabelText(/SemVer/), { target: { value: '1.0.0' } })
  fireEvent.change(screen.getByLabelText(/가격 \(atomic USDC\)/), { target: { value: '10000' } })
  fireEvent.change(screen.getByLabelText(/Network/), { target: { value: 'eip155:84532' } })
  fireEvent.change(screen.getByLabelText(/Asset/), { target: { value: 'USDC' } })
  fireEvent.change(screen.getByLabelText(/Endpoint/), { target: { value: 'http://localhost:8090/agent' } })
  fireEvent.change(screen.getByLabelText(/PayTo wallet/), { target: { value: '0x0000000000000000000000000000000000000001' } })
}

describe('VersionForm', () => {
  it('defaults to JSON and submits a selected response format', () => {
    const onSubmit = vi.fn()
    render(<VersionForm isSubmitting={false} onSubmit={onSubmit} />)
    expect(screen.getByLabelText(/응답 형식/)).toHaveValue('JSON')
    fillValidVersion()
    fireEvent.change(screen.getByLabelText(/응답 형식/), { target: { value: 'STRUCTURED' } })
    fireEvent.click(screen.getByRole('button', { name: 'DRAFT Version 생성' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ responseFormat: 'STRUCTURED' }))
  })
})
