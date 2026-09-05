import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { RegisterAgentInput } from '../../entities/agent/api'
import { AgentForm } from './AgentForm'

function fillBasic() {
  fireEvent.change(screen.getByLabelText(/Agent 주소/), { target: { value: 'risk-agent' } })
  fireEvent.change(screen.getByLabelText(/Agent 이름/), { target: { value: 'Risk Agent' } })
  fireEvent.change(screen.getByLabelText(/^설명/), { target: { value: 'Fixture risk analysis' } })
}
function next() { fireEvent.click(screen.getByRole('button', { name: '다음' })) }
function fillPayment() {
  fireEvent.change(screen.getByLabelText(/수익 수령 지갑/), { target: { value: '0x0000000000000000000000000000000000000001' } })
}
afterEach(cleanup)

describe('AgentForm', () => {
  it('retains input across steps and submits decimal-safe data only after final confirmation', async () => {
    const submitted: RegisterAgentInput[] = []
    render(<AgentForm isSubmitting={false} onSubmit={async (input) => { submitted.push(input) }} />)
    fillBasic(); next()
    fireEvent.click(screen.getByRole('button', { name: '이전' }))
    expect(screen.getByLabelText(/Agent 이름/)).toHaveValue('Risk Agent')
    next(); next(); fillPayment()
    fireEvent.change(screen.getByLabelText(/호출 가격/), { target: { value: '1.234567' } })
    next()
    expect(submitted).toHaveLength(0)
    expect(screen.getByRole('heading', { name: '등록 내용을 확인하세요' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Developer ID/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Agent 등록' }))
    await waitFor(() => expect(submitted).toEqual([expect.objectContaining({ priceAtomic: '1234567', responseFormat: 'JSON', semver: '1.0.0' })]))
  })
  it('submits the selected response format', async () => {
    const submitted: RegisterAgentInput[] = []
    render(<AgentForm isSubmitting={false} onSubmit={async (input) => { submitted.push(input) }} />)
    fillBasic(); next()
    fireEvent.change(screen.getByLabelText(/응답 형식/), { target: { value: 'MARKDOWN' } })
    next(); fillPayment(); next()
    fireEvent.click(screen.getByRole('button', { name: 'Agent 등록' }))
    await waitFor(() => expect(submitted[0]?.responseFormat).toBe('MARKDOWN'))
  })
  it('focuses the first invalid field before moving to the next step', () => {
    const submitted: RegisterAgentInput[] = []
    render(<AgentForm isSubmitting={false} onSubmit={async (input) => { submitted.push(input) }} />)
    next()
    expect(screen.getByRole('alert')).toHaveTextContent('입력 내용을 확인하세요.')
    expect(screen.getByLabelText(/Agent 주소/)).toHaveFocus()
    expect(submitted).toHaveLength(0)
  })
  it('blocks same-tick duplicate final submits until the request resolves', async () => {
    const submitted: RegisterAgentInput[] = []
    let resolveRequest: (() => void) | undefined
    render(<AgentForm isSubmitting={false} onSubmit={(input) => { submitted.push(input); return new Promise<void>((resolve) => { resolveRequest = resolve }) }} />)
    fillBasic(); next(); next(); fillPayment(); next()
    const form = screen.getByRole('button', { name: 'Agent 등록' }).closest('form')!
    fireEvent.submit(form); fireEvent.submit(form)
    expect(submitted).toHaveLength(1)
    await act(async () => { resolveRequest?.() })
    expect(submitted).toHaveLength(1)
  })
})
