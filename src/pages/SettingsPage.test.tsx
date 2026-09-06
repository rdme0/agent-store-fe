import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { SettingsPage } from './SettingsPage'

describe('SettingsPage', () => {
  it('describes the public connection without exposing demo lifetime details', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><SettingsPage /></MemoryRouter></QueryClientProvider>)

    expect(screen.getByText('API 연결')).toBeInTheDocument()
    expect(screen.queryByText('데모 이용')).not.toBeInTheDocument()
    expect(screen.queryByText(/시간|까지/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Developer Dashboard 열기' })).toHaveAttribute('href', '/developer/revenue')
  })
})
