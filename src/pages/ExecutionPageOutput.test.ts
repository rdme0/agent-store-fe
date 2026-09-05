import { describe, expect, it } from 'vitest'
import { hasRenderableExecutionOutput } from './executionOutput'

describe('hasRenderableExecutionOutput', () => {
  it('does not treat an absent or null output as a final result', () => {
    expect(hasRenderableExecutionOutput(undefined)).toBe(false)
    expect(hasRenderableExecutionOutput(null)).toBe(false)
  })

  it('renders concrete output values', () => {
    expect(hasRenderableExecutionOutput({ answer: '완료' })).toBe(true)
    expect(hasRenderableExecutionOutput('완료')).toBe(true)
    expect(hasRenderableExecutionOutput(false)).toBe(true)
  })
})
