import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { SettingsPage } from './SettingsPage'

describe('SettingsPage', () => {
  it('describes the six-hour demo access requirement', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><SettingsPage /></MemoryRouter></QueryClientProvider>)

    expect(screen.getByText('랜딩에서 데모를 시작해 주세요.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Developer Dashboard 열기' })).toHaveAttribute('href', '/developer/revenue')
  })
})
