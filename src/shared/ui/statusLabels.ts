const versionStatusLabels: Record<string, string> = {
  DRAFT: '작성 중',
  ACTIVE: '공개됨',
  DISABLED: '비활성화됨',
}

export function versionStatusLabel(status: string): string {
  return versionStatusLabels[status] ?? status
}

export function formatRelativeTime(value: string | undefined | null, now = Date.now()): string {
  if (!value) return '아직 없음'
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return '시각을 확인할 수 없음'
  const seconds = Math.round((timestamp - now) / 1000)
  const absolute = Math.abs(seconds)
  const unit = absolute >= 86_400 ? 'day' : absolute >= 3_600 ? 'hour' : 'minute'
  const divisor = unit === 'day' ? 86_400 : unit === 'hour' ? 3_600 : 60
  const valueInUnit = Math.round(seconds / divisor)
  return new Intl.RelativeTimeFormat('ko-KR', { numeric: 'auto' }).format(valueInUnit, unit)
}
