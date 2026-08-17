import { describe, expect, it } from 'vitest'
import { API_BASE_URL, env } from './env'

describe('runtime environment', () => {
  it('exposes one normalized API base URL', () => {
    expect(API_BASE_URL).not.toMatch(/\/$/)
    expect(env.apiBaseUrl).toBe(API_BASE_URL)
  })
})
