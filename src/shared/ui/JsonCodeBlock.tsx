import { useState, type ReactNode } from 'react'
import { formatJsonValue } from '../json/formatJson'

interface JsonCodeBlockProps {
  value: unknown
  label?: string
  className?: string
}

const jsonTokenPattern = /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g

export function JsonCodeBlock({ value, label = 'JSON', className }: JsonCodeBlockProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const formatted = formatJsonValue(value)
  const rootClassName = className ? `json-code-block ${className}` : 'json-code-block'

  async function copyJson() {
    try {
      await writeClipboard(formatted)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  return (
    <section aria-label={label} className={rootClassName}>
      <div className="json-code-block__toolbar">
        <span className="json-code-block__label">{label}</span>
        <button className="json-code-block__copy" onClick={() => void copyJson()} type="button">
          {copyState === 'copied' ? '복사됨' : copyState === 'error' ? '복사 실패' : '복사'}
        </button>
      </div>
      {copyState === 'copied' ? <span className="visually-hidden" role="status">JSON을 복사했습니다.</span> : null}
      {copyState === 'error' ? <span className="visually-hidden" role="alert">JSON을 복사하지 못했습니다.</span> : null}
      <pre className="json-code-block__surface"><code className="json-code-block__code">{formatted.split('\n').map((line, index) => <span className="json-code-block__line" key={`${index}-${line}`}>{tokenizeJsonLine(line, index)}</span>)}</code></pre>
    </section>
  )
}

function tokenizeJsonLine(line: string, lineIndex: number): ReactNode[] {
  const tokens: ReactNode[] = []
  let cursor = 0
  let tokenIndex = 0

  for (const match of line.matchAll(jsonTokenPattern)) {
    const index = match.index ?? 0
    if (index > cursor) {
      tokens.push(line.slice(cursor, index))
    }
    const token = match[0]
    const tokenType = token.startsWith('"')
      ? /^\s*:/.test(line.slice(index + token.length)) ? 'key' : 'string'
      : token === 'true' || token === 'false' ? 'boolean' : token === 'null' ? 'null' : 'number'
    tokens.push(<span className={`json-token json-token--${tokenType}`} key={`${lineIndex}-${tokenIndex}`}>{token}</span>)
    tokenIndex += 1
    cursor = index + token.length
  }

  if (cursor < line.length) {
    tokens.push(line.slice(cursor))
  }
  return tokens
}

async function writeClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  let copied: boolean
  try {
    textarea.select()
    copied = document.execCommand?.('copy') ?? false
  } finally {
    textarea.remove()
  }
  if (!copied) {
    throw new Error('Clipboard is unavailable')
  }
}
