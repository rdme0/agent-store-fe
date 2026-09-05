import { Menu, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  createBrowserRouter,
  isRouteErrorResponse,
  NavLink,
  Navigate,
  Outlet,
  type RouteObject,
  RouterProvider,
  useLocation,
  useNavigate,
  useRouteError,
} from 'react-router-dom'
import { BrandMark } from '../shared/ui/BrandMark'
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
import { LandingPage } from '../pages/LandingPage'
import { ErrorBoundary } from './ErrorBoundary'
import { useDisplayMode } from './DisplayModeContext'
import { currentDemoAccess } from '../shared/auth/demoAccess'

const navigationItems = [
  { label: 'Marketplace', to: '/marketplace', end: true },
  { label: 'Agent 등록', to: '/agents/new', end: false },
  { label: '기능 계약', to: '/function-contracts', end: true },
  { label: '매니페스트 등록', to: '/agent-manifests/new', end: true },
  { label: '개발자 대시보드', to: '/developer/revenue', end: true },
]
const drawerFocusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function isDeveloperOnlyPath(pathname: string): boolean {
  return pathname === '/agents/new'
    || pathname === '/agent-manifests/new'
    || pathname === '/function-contracts'
    || pathname === '/developer/revenue'
    || pathname === '/settings'
    || /^\/agents\/[^/]+\/versions\/new$/.test(pathname)
}

function AppShell() {
  const { displayMode, setDisplayMode } = useDisplayMode()
  const location = useLocation()
  const navigate = useNavigate()
  const [isMenuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const hasDemoAccess = Boolean(currentDemoAccess())
  const isDeveloperMode = hasDemoAccess && displayMode === 'developer'
  const isLandingPage = location.pathname === '/'
  const showsDeveloperChrome = isDeveloperMode && !isLandingPage
  const visibleNavigationItems = showsDeveloperChrome
    ? navigationItems
    : [{ label: 'Marketplace', to: '/marketplace', end: true }]

  useEffect(() => {
    const endDemo = () => {
      setDisplayMode('easy')
      navigate('/', { replace: true })
    }
    window.addEventListener('agentstore-demo-access-ended', endDemo)
    return () => window.removeEventListener('agentstore-demo-access-ended', endDemo)
  }, [navigate, setDisplayMode])

  function changeDisplayMode(mode: 'easy' | 'developer') {
    if (mode === 'easy' && isDeveloperOnlyPath(location.pathname)) {
      navigate('/marketplace', { replace: true })
    }
    setDisplayMode(mode)
  }

  function closeMenu(restoreFocus: boolean) {
    setMenuOpen(false)
    if (restoreFocus) {
      menuButtonRef.current?.focus()
    }
  }

  function openMenu() {
    setMenuOpen(true)
    window.requestAnimationFrame(() => {
      drawerRef.current?.querySelector<HTMLElement>(drawerFocusableSelector)?.focus()
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
    const focusableElements = drawerRef.current?.querySelectorAll<HTMLElement>(drawerFocusableSelector)
    if (!focusableElements || focusableElements.length === 0) {
      return
    }
    const first = focusableElements[0]
    const last = focusableElements[focusableElements.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className={showsDeveloperChrome ? 'app-shell app-shell--developer' : 'app-shell'}>
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <header className="app-header">
        <div className="app-header__inner">
          <NavLink className="brand" to="/" end>
            <BrandMark compact />
            <span className="brand__word">AgentStore</span>
            {showsDeveloperChrome ? <span className="brand__mode">Developer</span> : null}
          </NavLink>
          {!showsDeveloperChrome ? (
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
          ) : null}
          <div className="app-header__actions">
            {hasDemoAccess && !isLandingPage ? <DisplayModeToggle displayMode={displayMode} onChange={changeDisplayMode} /> : null}
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
              {hasDemoAccess && !isLandingPage ? <DisplayModeToggle displayMode={displayMode} onChange={(mode) => { changeDisplayMode(mode); closeMenu(true) }} /> : null}
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
              {showsDeveloperChrome ? <NavLink className="mobile-navigation__link" onClick={() => closeMenu(false)} to="/settings">연결 정보</NavLink> : null}
            </nav>
          </div>
        ) : null}
      </header>
      {showsDeveloperChrome ? (
        <div className="developer-layout">
          <aside aria-label="개발자 탐색" className="developer-sidebar">
            <p>개발자 도구</p>
            <nav>
              {navigationItems.map((item) => (
                <NavLink
                  className={({ isActive }) => isActive ? 'developer-sidebar__link developer-sidebar__link--active' : 'developer-sidebar__link'}
                  end={item.end}
                  key={item.to}
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ))}
              <NavLink className={({ isActive }) => isActive ? 'developer-sidebar__link developer-sidebar__link--active' : 'developer-sidebar__link'} to="/settings">
                연결 정보
              </NavLink>
            </nav>
          </aside>
          <main className="app-main" id="main-content"><Outlet /></main>
        </div>
      ) : <main className="app-main" id="main-content"><Outlet /></main>}
    </div>
  )
}

function DisplayModeToggle({ displayMode, onChange }: { displayMode: 'easy' | 'developer'; onChange: (mode: 'easy' | 'developer') => void }) {
  return (
    <div aria-label="화면 모드" className="display-mode-toggle" role="group">
      <button aria-pressed={displayMode === 'easy'} className={displayMode === 'easy' ? 'display-mode-toggle__button display-mode-toggle__button--active' : 'display-mode-toggle__button'} onClick={() => onChange('easy')} type="button">쉬운 사용</button>
      <button aria-pressed={displayMode === 'developer'} className={displayMode === 'developer' ? 'display-mode-toggle__button display-mode-toggle__button--active' : 'display-mode-toggle__button'} onClick={() => onChange('developer')} type="button">개발자 모드</button>
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
      <a className="button button--primary" href="/marketplace">Marketplace로 돌아가기</a>
    </main>
  )
}

function DeveloperRoute({ children }: { children: ReactNode }) {
  const { displayMode, setDisplayMode } = useDisplayMode()
  const access = currentDemoAccess()

  useEffect(() => {
    if (access && displayMode !== 'developer') setDisplayMode('developer')
  }, [access, displayMode, setDisplayMode])

  if (!access) return <Navigate replace to="/?developer=1" />
  if (displayMode !== 'developer') return null
  return children
}

function DemoAccessRoute({ children }: { children: ReactNode }) {
  return currentDemoAccess() ? children : <Navigate replace to="/?demo=1" />
}

// eslint-disable-next-line react-refresh/only-export-components
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'marketplace', element: <DemoAccessRoute><AgentsPage /></DemoAccessRoute> },
      { path: 'agents', element: <Navigate replace to="/marketplace" /> },
      { path: 'agents/new', element: <DeveloperRoute><RegisterAgentPage /></DeveloperRoute> },
      { path: 'agent-manifests/new', element: <DeveloperRoute><AgentManifestPage /></DeveloperRoute> },
      { path: 'agents/:code/versions/new', element: <DeveloperRoute><NewAgentVersionPage /></DeveloperRoute> },
      { path: 'agents/:code', element: <AgentDetailPage /> },
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
