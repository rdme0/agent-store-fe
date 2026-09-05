import { useId, useState } from 'react'
import { tryFormatJsonText } from '../json/formatJson'

interface JsonEditorProps {
  name: string
  label: string
  defaultValue: string
  rows?: number
  required?: boolean
  id?: string
}

export function JsonEditor({ name, label, defaultValue, rows = 12, required = false, id }: JsonEditorProps) {
  const generatedId = useId()
  const inputId = id ?? `json-editor-${generatedId}`
  const errorId = `${inputId}-error`
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState<string>()

  function formatValue() {
    const result = tryFormatJsonText(value)
    if (!result.value) {
      setError(result.error ?? '유효한 JSON 형식이 아닙니다.')
      return
    }
    setValue(result.value)
    setError(undefined)
  }

  return (
    <div className="json-editor">
      <div className="json-editor__header">
        <label className="json-editor__label" htmlFor={inputId}>{label}</label>
        <button className="json-editor__format" onClick={formatValue} type="button">JSON 정렬</button>
      </div>
      <textarea
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        id={inputId}
        name={name}
        onChange={(event) => { setValue(event.target.value); setError(undefined) }}
        required={required}
        rows={rows}
        spellCheck={false}
        value={value}
      />
      {error ? <p className="json-editor__error" id={errorId} role="alert">{error}</p> : null}
    </div>
  )
}
