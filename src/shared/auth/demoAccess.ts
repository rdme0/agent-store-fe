const STORAGE_KEY = 'agentstore.demo-access'
const DISPLAY_MODE_STORAGE_KEY = 'agentstore.display-mode'

export interface DemoAccess {
  accessToken: string
  expiresAt: string
}

function isDemoAccess(value: unknown): value is DemoAccess {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { accessToken?: unknown; expiresAt?: unknown }
  return typeof candidate.accessToken === 'string' && candidate.accessToken.length > 0 && typeof candidate.expiresAt === 'string'
}

export function currentDemoAccess(): DemoAccess | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const access = JSON.parse(raw) as unknown
    if (!isDemoAccess(access) || Number.isNaN(Date.parse(access.expiresAt)) || Date.parse(access.expiresAt) <= Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY)
      return undefined
    }
    return access
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return undefined
  }
}

export function storeDemoAccess(access: DemoAccess): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(access))
}

export function clearDemoAccess(): void {
  window.localStorage.removeItem(STORAGE_KEY)
  window.localStorage.removeItem(DISPLAY_MODE_STORAGE_KEY)
  window.dispatchEvent(new Event('agentstore-demo-access-ended'))
}
