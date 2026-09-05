import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { HomePage } from './HomePage'

describe('home page foundation', () => {
  it('links the final user flow from Marketplace to execution and revenue', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Agent를 찾아 실행하고, 결과와 수익을 확인하세요.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Marketplace 열기' })).toHaveAttribute('href', '/marketplace')
    expect(screen.getByText('2. 실행 상태').closest('a')).toBeNull()
    expect(screen.getByRole('link', { name: /Developer Dashboard/ })).toHaveAttribute('href', '/developer/revenue')
  })
})
