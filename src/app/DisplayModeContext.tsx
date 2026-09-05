import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { clearDemoAccess, currentDemoAccess } from '../shared/auth/demoAccess'

export type DisplayMode = 'easy' | 'developer'

const STORAGE_KEY = 'agentstore.display-mode'
const EXPIRY_RECHECK_MS = 24 * 60 * 60 * 1000

interface DisplayModeContextValue {
  displayMode: DisplayMode
  setDisplayMode: (mode: DisplayMode) => void
}

const DisplayModeContext = createContext<DisplayModeContextValue | null>(null)

function initialDisplayMode(): DisplayMode {
  if (window.localStorage.getItem(STORAGE_KEY) === 'developer') return 'developer'
  return 'easy'
}

export function DisplayModeProvider({ children }: { children: ReactNode }) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>(initialDisplayMode)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, displayMode)
  }, [displayMode])

  useEffect(() => {
    const hadStoredAccess = window.localStorage.getItem('agentstore.demo-access') !== null
    const access = currentDemoAccess()
    if (!access) {
      if (hadStoredAccess && displayMode === 'developer') {
        const timeout = window.setTimeout(() => setDisplayMode('easy'), 0)
        return () => window.clearTimeout(timeout)
      }
      return
    }
    const expiresAt = Date.parse(access.expiresAt)
    const expire = () => {
      clearDemoAccess()
      setDisplayMode('easy')
    }
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      const timeout = window.setTimeout(expire, 0)
      return () => window.clearTimeout(timeout)
    }
    let timeout: number | undefined
    const checkExpiry = () => {
      const remaining = expiresAt - Date.now()
      if (remaining <= 0) {
        expire()
        return
      }
      timeout = window.setTimeout(checkExpiry, Math.min(remaining, EXPIRY_RECHECK_MS))
    }
    checkExpiry()
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout)
    }
  }, [displayMode])

  const guardedSetDisplayMode = (mode: DisplayMode) => setDisplayMode(mode === 'developer' && !currentDemoAccess() ? 'easy' : mode)
  return <DisplayModeContext.Provider value={{ displayMode, setDisplayMode: guardedSetDisplayMode }}>{children}</DisplayModeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDisplayMode(): DisplayModeContextValue {
  const value = useContext(DisplayModeContext)
  return value ?? { displayMode: 'easy', setDisplayMode: () => undefined }
}
