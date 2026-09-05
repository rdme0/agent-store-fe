import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JsonCodeBlock } from './JsonCodeBlock'

afterEach(() => cleanup())

describe('JsonCodeBlock', () => {
  it('renders formatted JSON with line numbers and token classes', () => {
    const { container } = render(<JsonCodeBlock label="입력 계약 JSON" value={{ type: 'object', required: true, count: 2, note: null }} />)

    expect(screen.getByRole('region', { name: '입력 계약 JSON' })).toBeInTheDocument()
    expect(container.querySelectorAll('.json-code-block__line')).toHaveLength(6)
    expect(container.querySelector('.json-token--key')).toBeInTheDocument()
    expect(container.querySelector('.json-token--string')).toBeInTheDocument()
    expect(container.querySelector('.json-token--boolean')).toBeInTheDocument()
    expect(container.querySelector('.json-token--number')).toBeInTheDocument()
    expect(container.querySelector('.json-token--null')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '복사' })).toBeInTheDocument()
  })

  it('copies the normalized JSON and announces completion', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<JsonCodeBlock value={'{"type":"object"}'} />)

    fireEvent.click(screen.getByRole('button', { name: '복사' }))

    await waitFor(() => expect(screen.getByRole('button', { name: '복사됨' })).toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('JSON을 복사했습니다.')
    expect(writeText).toHaveBeenCalledWith('{\n  "type": "object"\n}')
  })
})
