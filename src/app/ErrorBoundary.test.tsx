import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function ThrowingChild(): never {
  throw new Error('test render failure')
}

describe('ErrorBoundary', () => {
  it('renders a recovery action when a child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '화면을 표시할 수 없습니다' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '새로고침' }),
    ).toBeInTheDocument()

    consoleError.mockRestore()
  })
})
