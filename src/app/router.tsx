import {
  createBrowserRouter,
  isRouteErrorResponse,
  NavLink,
  Outlet,
  type RouteObject,
  RouterProvider,
  useRouteError,
} from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
import { AgentsPage } from '../pages/AgentsPage'
import { AgentDetailPage } from '../pages/AgentDetailPage'
import { HomePage } from '../pages/HomePage'
import { NewAgentVersionPage } from '../pages/NewAgentVersionPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { RegisterAgentPage } from '../pages/RegisterAgentPage'
import { RunsPage } from '../pages/RunsPage'
import { SettingsPage } from '../pages/SettingsPage'

const navigationItems = [
  { label: 'Overview', to: '/', end: true },
  { label: 'Agents', to: '/agents', end: false },
  { label: 'Runs', to: '/runs', end: false },
  { label: 'Settings', to: '/settings', end: false },
]

function AppShell() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="app-shell__sidebar" aria-label="Primary navigation">
        <NavLink className="brand" to="/" end>
          <span className="brand__mark" aria-hidden="true">
            A
          </span>
          <span>AgentStore</span>
        </NavLink>
        <nav>
          <p className="nav-label">Workspace</p>
          <ul className="nav-list">
            {navigationItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  className={({ isActive }) =>
                    isActive ? 'nav-link nav-link--active' : 'nav-link'
                  }
                  to={item.to}
                  end={item.end}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <p className="app-shell__version">Foundation · v0.1</p>
      </aside>
      <div className="app-shell__content">
        <header className="app-shell__header">
          <p>Agent workspace</p>
          <span className="status-pill">
            <span className="status-pill__dot" aria-hidden="true" />
            Ready
          </span>
        </header>
        <main id="main-content" className="app-shell__main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function RouteErrorPage() {
  const error = useRouteError()
  const title = isRouteErrorResponse(error)
    ? `${error.status} · ${error.statusText}`
    : 'Unable to open this page'

  return (
    <main className="error-page" role="alert">
      <p className="eyebrow">AgentStore</p>
      <h1>{title}</h1>
      <p>There was a problem loading this route.</p>
      <a className="button button--primary" href="/">
        Return home
      </a>
    </main>
  )
}

// Routes are exported for memory-router integration tests and future route composition.
// eslint-disable-next-line react-refresh/only-export-components
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'agents', element: <AgentsPage /> },
      { path: 'agents/new', element: <RegisterAgentPage /> },
      { path: 'agents/:slug/versions/new', element: <NewAgentVersionPage /> },
      { path: 'agents/:slug', element: <AgentDetailPage /> },
      { path: 'runs', element: <RunsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

// The router is a module-level singleton so it can be shared by app bootstrapping and tests.
// eslint-disable-next-line react-refresh/only-export-components
export const router = createBrowserRouter(routes)

export function AppRouter() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  )
}
