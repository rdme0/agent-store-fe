import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../shared/config/env', () => ({
  API_BASE_URL: 'http://localhost:8080',
  DEMO_DEVELOPER_ID: '',
}))

import { SettingsPage } from './SettingsPage'

describe('SettingsPage', () => {
  it('explains how to enable the dashboard when the demo developer is not configured', () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    expect(screen.getByText('VITE_DEMO_DEVELOPER_ID가 설정되지 않음')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('VITE_DEMO_DEVELOPER_ID')
  })
})
