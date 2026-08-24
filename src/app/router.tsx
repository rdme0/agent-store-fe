import { Menu, X } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  createBrowserRouter,
  isRouteErrorResponse,
  NavLink,
  Navigate,
  Outlet,
  type RouteObject,
  RouterProvider,
  useRouteError,
} from 'react-router-dom'
import { ConnectionStatus } from '../features/system/ConnectionStatus'
import { AgentDetailPage } from '../pages/AgentDetailPage'
import { AgentManifestPage } from '../pages/AgentManifestPage'
import { AgentsPage } from '../pages/AgentsPage'
import { FunctionContractsPage } from '../pages/FunctionContractsPage'
import { DeveloperDashboardPage } from '../pages/DeveloperDashboardPage'
import { ExecutionPage } from '../pages/ExecutionPage'
import { NewAgentVersionPage } from '../pages/NewAgentVersionPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { RegisterAgentPage } from '../pages/RegisterAgentPage'
import { SettingsPage } from '../pages/SettingsPage'
import { ErrorBoundary } from './ErrorBoundary'
import { useDisplayMode } from './DisplayModeContext'

const navigationItems = [
  { label: 'Marketplace', to: '/', end: true },
  { label: 'Agent 등록', to: '/agents/new', end: false },
  { label: '기능 계약', to: '/function-contracts', end: true },
  { label: '매니페스트 등록', to: '/agent-manifests/new', end: true },
  { label: '개발자 대시보드', to: '/developer/revenue', end: true },
]

function AppShell() {
  const { displayMode, setDisplayMode } = useDisplayMode()
  const [isMenuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const visibleNavigationItems = displayMode === 'developer'
    ? navigationItems
    : navigationItems.filter((item) => item.to === '/')

  function closeMenu(restoreFocus: boolean) {
    setMenuOpen(false)
    if (restoreFocus) {
      menuButtonRef.current?.focus()
    }
  }

  function openMenu() {
    setMenuOpen(true)
    window.requestAnimationFrame(() => {
      drawerRef.current?.querySelector<HTMLAnchorElement>('a')?.focus()
    })
  }

  function handleDrawerKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu(true)
      return
    }
    if (event.key !== 'Tab') {
      return
    }
    const links = drawerRef.current?.querySelectorAll<HTMLAnchorElement>('a')
    if (!links || links.length === 0) {
      return
    }
    const first = links[0]
    const last = links[links.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <header className="app-header">
        <div className="app-header__inner">
          <NavLink className="brand" to="/" end>
            <span className="brand__mark" aria-hidden="true">A</span>
            <span>AgentStore</span>
          </NavLink>
          <nav aria-label="주요 탐색" className="app-navigation">
            {visibleNavigationItems.map((item) => (
              <NavLink
                className={({ isActive }) => isActive ? 'app-navigation__link app-navigation__link--active' : 'app-navigation__link'}
                end={item.end}
                key={item.to}
                onClick={() => closeMenu(false)}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="app-header__actions">
            <DisplayModeToggle displayMode={displayMode} onChange={setDisplayMode} />
            <ConnectionStatus />
            <button
              aria-controls={menuId}
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
              className="icon-button app-header__menu-button"
              onClick={() => isMenuOpen ? closeMenu(true) : openMenu()}
              ref={menuButtonRef}
              type="button"
            >
              {isMenuOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
            </button>
          </div>
        </div>
        {isMenuOpen ? (
          <div className="mobile-drawer-layer">
            <button aria-label="메뉴 닫기" className="mobile-drawer-layer__backdrop" onClick={() => closeMenu(true)} type="button" />
            <nav aria-label="모바일 주요 탐색" aria-modal="true" className="mobile-navigation" id={menuId} onKeyDown={handleDrawerKeyDown} ref={drawerRef} role="dialog">
              <DisplayModeToggle displayMode={displayMode} onChange={setDisplayMode} />
              {visibleNavigationItems.map((item) => (
                <NavLink
                  className={({ isActive }) => isActive ? 'mobile-navigation__link mobile-navigation__link--active' : 'mobile-navigation__link'}
                  end={item.end}
                  key={item.to}
                  onClick={() => closeMenu(false)}
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ))}
              {displayMode === 'developer' ? <NavLink className="mobile-navigation__link" onClick={() => closeMenu(false)} to="/settings">연결 정보</NavLink> : null}
            </nav>
          </div>
        ) : null}
      </header>
      <main className="app-main" id="main-content"><Outlet /></main>
    </div>
  )
}

function DisplayModeToggle({ displayMode, onChange }: { displayMode: 'easy' | 'developer'; onChange: (mode: 'easy' | 'developer') => void }) {
  return (
    <div aria-label="화면 모드" className="display-mode-toggle" role="group">
      <button aria-pressed={displayMode === 'easy'} className={displayMode === 'easy' ? 'display-mode-toggle__button display-mode-toggle__button--active' : 'display-mode-toggle__button'} onClick={() => onChange('easy')} type="button">쉬운 사용</button>
      <button aria-pressed={displayMode === 'developer'} className={displayMode === 'developer' ? 'display-mode-toggle__button display-mode-toggle__button--active' : 'display-mode-toggle__button'} onClick={() => onChange('developer')} type="button">개발자</button>
    </div>
  )
}

function RouteErrorPage() {
  const error = useRouteError()
  const title = isRouteErrorResponse(error) ? `${error.status} · ${error.statusText}` : '페이지를 열 수 없습니다'

  return (
    <main className="error-page" role="alert">
      <p className="section-label">AgentStore</p>
      <h1>{title}</h1>
      <p>요청한 화면을 불러오는 중 문제가 발생했습니다.</p>
      <a className="button button--primary" href="/">Marketplace로 돌아가기</a>
    </main>
  )
}

function DeveloperRoute({ children }: { children: ReactNode }) {
  const { displayMode } = useDisplayMode()
  return displayMode === 'developer' ? children : <Navigate replace to="/" />
}

// eslint-disable-next-line react-refresh/only-export-components
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <AgentsPage /> },
      { path: 'agents', element: <Navigate replace to="/" /> },
      { path: 'agents/new', element: <DeveloperRoute><RegisterAgentPage /></DeveloperRoute> },
      { path: 'agent-manifests/new', element: <DeveloperRoute><AgentManifestPage /></DeveloperRoute> },
      { path: 'agents/:slug/versions/new', element: <DeveloperRoute><NewAgentVersionPage /></DeveloperRoute> },
      { path: 'agents/:slug', element: <AgentDetailPage /> },
      { path: 'function-contracts', element: <DeveloperRoute><FunctionContractsPage /></DeveloperRoute> },
      { path: 'runs/:id', element: <ExecutionPage /> },
      { path: 'developer/revenue', element: <DeveloperRoute><DeveloperDashboardPage /></DeveloperRoute> },
      { path: 'settings', element: <DeveloperRoute><SettingsPage /></DeveloperRoute> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

// eslint-disable-next-line react-refresh/only-export-components
export const router = createBrowserRouter(routes)

export function AppRouter() {
  return <ErrorBoundary><RouterProvider router={router} /></ErrorBoundary>
}
