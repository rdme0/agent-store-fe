import { fireEvent, render, screen } from '@testing-library/react'
import {
  createMemoryRouter,
  RouterProvider,
} from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { routes } from './router'

function renderAt(path: string) {
  const memoryRouter = createMemoryRouter(routes, {
    initialEntries: [path],
  })

  render(<RouterProvider router={memoryRouter} />)
}

describe('application routing', () => {
  it('navigates from the overview to the agents page', () => {
    renderAt('/')

    expect(
      screen.getByRole('heading', { name: 'A calmer way to run agents.' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Agents' }))

    expect(
      screen.getByRole('heading', { name: 'Your agent catalog' }),
    ).toBeInTheDocument()
  })

  it('renders the not-found page for an unknown path', () => {
    renderAt('/does-not-exist')

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return home' })).toBeInTheDocument()
  })
})
