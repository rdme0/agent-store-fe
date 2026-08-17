import { describe, expect, it } from 'vitest'
import { queryClient } from './queryClient'

describe('query client foundation', () => {
  it('uses conservative defaults for server state', () => {
    const defaults = queryClient.getDefaultOptions().queries

    if (!defaults) {
      throw new Error('Query defaults are not configured')
    }

    expect(defaults.refetchOnWindowFocus).toBe(false)
    expect(defaults.retry).toBe(1)
    expect(defaults.staleTime).toBe(30_000)
  })
})
