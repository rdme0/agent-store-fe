import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HomePage } from './HomePage'

describe('home page foundation', () => {
  it('renders the contract-free workspace introduction', () => {
    render(<HomePage />)

    expect(
      screen.getByRole('heading', { name: 'A calmer way to run agents.' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Workspace foundation')).toBeInTheDocument()
  })
})
