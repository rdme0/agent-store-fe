export function formatJsonValue(value: unknown): string {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return JSON.stringify(parsed, null, 2) ?? value
    } catch {
      return value
    }
  }

  const serialized = JSON.stringify(value, null, 2)
  return serialized ?? String(value)
}

export function tryFormatJsonText(source: string): { value?: string; error?: string } {
  try {
    const parsed = JSON.parse(source) as unknown
    return { value: JSON.stringify(parsed, null, 2) ?? source }
  } catch {
    return { error: '유효한 JSON 형식이 아닙니다.' }
  }
}
