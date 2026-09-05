import { describe, expect, it } from 'vitest'
import { formatJsonValue, tryFormatJsonText } from './formatJson'

describe('formatJsonValue', () => {
  it('pretty-prints objects and arrays with two-space indentation', () => {
    expect(formatJsonValue({ input: ['news', { limit: 5 }] })).toBe(`{
  "input": [
    "news",
    {
      "limit": 5
    }
  ]
}`)
  })

  it('parses and formats JSON strings while preserving ordinary strings', () => {
    expect(formatJsonValue('{"type":"object"}')).toBe(`{
  "type": "object"
}`)
    expect(formatJsonValue('not json')).toBe('not json')
  })

  it('falls back to a readable string for primitive and undefined values', () => {
    expect(formatJsonValue(true)).toBe('true')
    expect(formatJsonValue(undefined)).toBe('undefined')
  })
})

describe('tryFormatJsonText', () => {
  it('returns formatted text for valid JSON', () => {
    expect(tryFormatJsonText('{"type":"object"}')).toEqual({ value: '{\n  "type": "object"\n}' })
  })

  it('returns an error without a replacement value for invalid JSON', () => {
    expect(tryFormatJsonText('{invalid')).toEqual({ error: '유효한 JSON 형식이 아닙니다.' })
  })
})
