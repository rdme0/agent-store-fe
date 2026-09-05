import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryRouter,
  RouterProvider,
} from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { routes } from './router'
import { queryClient } from './queryClient'
import { DisplayModeProvider } from './DisplayModeContext'

function renderAt(path: string, withDemoAccess = false) {
  window.localStorage.clear()
  if (withDemoAccess) {
    window.localStorage.setItem('agentstore.demo-access', JSON.stringify({ accessToken: 'router-fixture-access', expiresAt: new Date(Date.now() + 60_000).toISOString() }))
    window.localStorage.setItem('agentstore.display-mode', 'developer')
  }
  const memoryRouter = createMemoryRouter(routes, {
    initialEntries: [path],
  })

  render(
    <QueryClientProvider client={queryClient}>
      <DisplayModeProvider><RouterProvider router={memoryRouter} /></DisplayModeProvider>
    </QueryClientProvider>,
  )
  return memoryRouter
}

afterEach(() => cleanup())

describe('application routing', () => {
  it('uses the demo landing as the root route', () => {
    renderAt('/')

    expect(screen.getByRole('heading', { name: /AI 에이전트가 서로의 서비스를 고르고/ })).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /데모 시작/ })).toBeInTheDocument()
    expect(screen.getByText('클릭 한 번으로 AgentStore 데모를 시작합니다.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '개발자 대시보드' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: '화면 모드' })).not.toBeInTheDocument()
  })

  it('keeps the landing free of developer controls even when demo access remains stored', () => {
    renderAt('/', true)

    expect(screen.queryByLabelText('개발자 탐색')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: '화면 모드' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '데모 종료' })).not.toBeInTheDocument()
    expect(screen.queryByText('Developer', { exact: true })).not.toBeInTheDocument()
  })

  it('requires demo access before opening Marketplace', async () => {
    renderAt('/marketplace')

    expect(await screen.findByRole('button', { name: /데모 시작/ })).toBeInTheDocument()
  })

  it('renders the not-found page for an unknown path', () => {
    renderAt('/does-not-exist')

    expect(screen.getByRole('heading', { name: '요청한 페이지를 찾을 수 없습니다' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Marketplace로 돌아가기' })).toBeInTheDocument()
  })

  it('opens the mobile navigation as a keyboard-dismissible drawer and restores trigger focus', async () => {
    renderAt('/')

    const menuButton = screen.getByRole('button', { name: '메뉴 열기' })
    fireEvent.click(menuButton)

    const drawer = screen.getByRole('dialog', { name: '모바일 주요 탐색' })
    expect(drawer).toBeInTheDocument()
    await waitFor(() => expect(within(drawer).getByRole('link', { name: 'Marketplace' })).toHaveFocus())
    fireEvent.keyDown(drawer, { key: 'Tab', shiftKey: true })
    expect(within(drawer).getByRole('link', { name: 'Marketplace' })).toHaveFocus()
    fireEvent.keyDown(drawer, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: '모바일 주요 탐색' })).not.toBeInTheDocument()
    expect(menuButton).toHaveFocus()
  })

  it('shows the developer shell after demo access and keeps Marketplace open when modes switch', () => {
    const router = renderAt('/marketplace', true)

    expect(screen.getByLabelText('개발자 탐색')).toBeInTheDocument()
    const modeToggle = screen.getByRole('group', { name: '화면 모드' })
    expect(within(modeToggle).getByRole('button', { name: '개발자 모드' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: '데모 종료' })).not.toBeInTheDocument()
    expect(screen.queryByText('연결됨')).not.toBeInTheDocument()

    fireEvent.click(within(modeToggle).getByRole('button', { name: '쉬운 사용' }))

    expect(router.state.location.pathname).toBe('/marketplace')
    expect(screen.queryByLabelText('개발자 탐색')).not.toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: '화면 모드' })).getByRole('button', { name: '쉬운 사용' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('places the mode toggle first in the authenticated mobile drawer', async () => {
    renderAt('/marketplace', true)
    const menuButton = screen.getByRole('button', { name: '메뉴 열기' })
    fireEvent.click(menuButton)

    const drawer = screen.getByRole('dialog', { name: '모바일 주요 탐색' })
    await waitFor(() => expect(within(drawer).getByRole('button', { name: '쉬운 사용' })).toHaveFocus())
    expect(within(drawer).getByRole('button', { name: '개발자 모드' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(drawer).getByRole('button', { name: '쉬운 사용' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '모바일 주요 탐색' })).not.toBeInTheDocument())
    expect(menuButton).toHaveFocus()
  })

  it('returns to Marketplace before switching a developer-only route to easy mode', async () => {
    const router = renderAt('/developer/revenue', true)
    const modeToggle = screen.getByRole('group', { name: '화면 모드' })

    fireEvent.click(within(modeToggle).getByRole('button', { name: '쉬운 사용' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/marketplace'))
    await waitFor(() => expect(screen.queryByLabelText('개발자 탐색')).not.toBeInTheDocument())
  })
})
