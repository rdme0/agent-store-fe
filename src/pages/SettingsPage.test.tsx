import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { SettingsPage } from './SettingsPage'

describe('SettingsPage', () => {
  it('describes the long-lived demo access requirement', () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    expect(screen.getByText('데모 시작 뒤 365일 access로 연결')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Developer Dashboard 열기' })).toHaveAttribute('href', '/developer/revenue')
  })
})
