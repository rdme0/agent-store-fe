import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryRouter,
  RouterProvider,
} from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from './router'
import { queryClient } from './queryClient'

vi.mock('../entities/function-contract/api', () => ({
  listFunctionContracts: vi.fn().mockResolvedValue([]),
}))

function renderAt(path: string) {
  const memoryRouter = createMemoryRouter(routes, {
    initialEntries: [path],
  })

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={memoryRouter} />
    </QueryClientProvider>,
  )
}

afterEach(() => cleanup())

describe('application routing', () => {
  it('uses Marketplace as the root route', async () => {
    renderAt('/')

    expect(
      screen.getByRole('heading', { name: 'Agent Marketplace' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Agent 등록' }))

    expect(
      await screen.findByRole('heading', { name: '새 Agent 등록' }),
    ).toBeInTheDocument()
  })

  it('renders the not-found page for an unknown path', () => {
    renderAt('/does-not-exist')

    expect(screen.getByRole('heading', { name: '요청한 페이지를 찾을 수 없습니다' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Marketplace로 돌아가기' })).toBeInTheDocument()
  })

  it('opens the mobile navigation as a keyboard-dismissible drawer and restores trigger focus', () => {
    renderAt('/')

    const menuButton = screen.getByRole('button', { name: '메뉴 열기' })
    fireEvent.click(menuButton)

    const drawer = screen.getByRole('dialog', { name: '모바일 주요 탐색' })
    expect(drawer).toBeInTheDocument()
    fireEvent.keyDown(drawer, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: '모바일 주요 탐색' })).not.toBeInTheDocument()
    expect(menuButton).toHaveFocus()
  })
})
