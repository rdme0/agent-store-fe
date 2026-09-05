import { describe, expect, it } from 'vitest'
import { formatRelativeTime, versionStatusLabel } from './statusLabels'

describe('status labels', () => {
  it('translates version states for the developer dashboard', () => {
    expect(versionStatusLabel('DRAFT')).toBe('작성 중')
    expect(versionStatusLabel('ACTIVE')).toBe('공개됨')
  })

  it('formats a stable relative certification time', () => {
    const now = Date.parse('2026-09-05T00:00:00.000Z')
    expect(formatRelativeTime('2026-09-04T23:00:00.000Z', now)).toBe('1시간 전')
    expect(formatRelativeTime(null, now)).toBe('아직 없음')
  })
})
