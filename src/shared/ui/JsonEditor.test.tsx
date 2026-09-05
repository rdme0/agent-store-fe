import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { JsonEditor } from './JsonEditor'

afterEach(() => cleanup())

describe('JsonEditor', () => {
  it('formats valid input and keeps the formatted value in form submission', () => {
    const compactValue = JSON.stringify({ type: 'object' })
    render(<form><JsonEditor defaultValue={compactValue} label="입력 계약 Schema" name="inputSchema" /></form>)
    const editor = screen.getByLabelText('입력 계약 Schema') as HTMLTextAreaElement

    fireEvent.click(screen.getByRole('button', { name: 'JSON 정렬' }))

    expect(editor).toHaveValue('{\n  "type": "object"\n}')
    expect(new FormData(editor.form!).get('inputSchema')).toBe('{\n  "type": "object"\n}')
  })

  it('preserves invalid input and shows an accessible formatting error', () => {
    render(<JsonEditor defaultValue="{}" label="출력 계약 Schema" name="outputSchema" />)
    const editor = screen.getByLabelText('출력 계약 Schema')
    fireEvent.change(editor, { target: { value: '{invalid' } })

    fireEvent.click(screen.getByRole('button', { name: 'JSON 정렬' }))

    expect(editor).toHaveValue('{invalid')
    expect(editor).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('유효한 JSON 형식이 아닙니다.')
  })
})
