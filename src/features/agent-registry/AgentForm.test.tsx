import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AgentForm } from './AgentForm'

describe('AgentForm', () => {
  it('submits the generated API-shaped payload after valid input', () => {
    const onSubmit = vi.fn()
    render(<AgentForm isSubmitting={false} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/Developer ID/), {
      target: { value: '123e4567-e89b-12d3-a456-426614174000' },
    })
    fireEvent.change(screen.getByLabelText(/^Slug/), { target: { value: 'risk-agent' } })
    fireEvent.change(screen.getByLabelText(/Agent 이름/), { target: { value: 'Risk Agent' } })
    fireEvent.change(screen.getByLabelText(/^설명/), { target: { value: 'Fixture risk analysis' } })
    fireEvent.change(screen.getByLabelText(/PayTo wallet/), {
      target: { value: '0x0000000000000000000000000000000000000001' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'DRAFT Agent 등록' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      developerId: '123e4567-e89b-12d3-a456-426614174000',
      priceAtomic: '10000',
      semver: '1.0.0',
    }))
  })
})
