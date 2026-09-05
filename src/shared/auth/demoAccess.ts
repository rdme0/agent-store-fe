const STORAGE_KEY = 'agentstore.demo-access'
const DISPLAY_MODE_STORAGE_KEY = 'agentstore.display-mode'
let accessGeneration = 0
export const demoAccessGeneration = () => accessGeneration

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
  if (!isDemoAccess(access) || !Number.isFinite(Date.parse(access.expiresAt)) || Date.parse(access.expiresAt) <= Date.now()) throw new Error('데모 이용 정보를 확인하지 못했습니다. 다시 시도해 주세요.')
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(access))
  window.dispatchEvent(new Event('agentstore-demo-access-changed'))
}

export function clearDemoAccess(reason: 'ended' | 'expired' | 'unauthorized' = 'ended'): void {
  accessGeneration += 1
  window.localStorage.removeItem(STORAGE_KEY)
  window.localStorage.removeItem(DISPLAY_MODE_STORAGE_KEY)
  window.dispatchEvent(new CustomEvent('agentstore-demo-access-ended', { detail: reason }))
}

export function formatDemoAccessRemaining(access: DemoAccess, now = Date.now()): string {
  const remainingMs = Date.parse(access.expiresAt) - now
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return '만료됨'
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000))
  if (remainingMinutes >= 60) {
    return `${Math.floor(remainingMinutes / 60)}시간 ${remainingMinutes % 60}분 남음`
  }
  return `${remainingMinutes}분 남음`
}
