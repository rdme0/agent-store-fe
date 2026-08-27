import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type DisplayMode = 'easy' | 'developer'

const STORAGE_KEY = 'agentstore.display-mode'

interface DisplayModeContextValue {
  displayMode: DisplayMode
  setDisplayMode: (mode: DisplayMode) => void
}

const DisplayModeContext = createContext<DisplayModeContextValue | null>(null)

function initialDisplayMode(): DisplayMode {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'developer' ? 'developer' : 'easy'
}

export function DisplayModeProvider({ children }: { children: ReactNode }) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>(initialDisplayMode)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, displayMode)
  }, [displayMode])

  return <DisplayModeContext.Provider value={{ displayMode, setDisplayMode }}>{children}</DisplayModeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDisplayMode(): DisplayModeContextValue {
  const value = useContext(DisplayModeContext)
  return value ?? { displayMode: 'easy', setDisplayMode: () => undefined }
}
