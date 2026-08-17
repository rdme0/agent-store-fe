import { useState, type FormEvent, type HTMLAttributes } from 'react'
import type { CreateVersionInput } from '../../entities/agent/api'
import { validateVersion, type FieldErrors, type VersionFormValues } from './validation'

interface VersionFormProps {
  isSubmitting: boolean
  serverError?: string
  onSubmit: (input: CreateVersionInput) => void
}

const initialValues: VersionFormValues = {
  semver: '',
  endpoint: '',
  priceAtomic: '',
  network: 'eip155:84532',
  asset: 'USDC',
  payTo: '',
}

export function VersionForm({ isSubmitting, onSubmit, serverError }: VersionFormProps) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<FieldErrors>({})

  function update(key: keyof VersionFormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateVersion(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit(values)
  }

  return (
    <form className="registry-form" onSubmit={submit} noValidate>
      <fieldset disabled={isSubmitting}>
        <legend>새 Version 정보</legend>
        <div className="form-grid">
          <Field error={errors.semver} id="version-semver" label="SemVer" value={values.semver} onChange={(value) => update('semver', value)} />
          <Field error={errors.priceAtomic} id="version-priceAtomic" label="가격 (atomic USDC)" value={values.priceAtomic} onChange={(value) => update('priceAtomic', value)} inputMode="numeric" />
          <Field error={errors.network} id="version-network" label="Network" value={values.network} onChange={(value) => update('network', value)} />
          <Field error={errors.asset} id="version-asset" label="Asset" value={values.asset} onChange={(value) => update('asset', value)} />
        </div>
        <Field error={errors.endpoint} id="version-endpoint" label="Endpoint" value={values.endpoint} onChange={(value) => update('endpoint', value)} />
        <Field error={errors.payTo} id="version-payTo" label="PayTo wallet" value={values.payTo} onChange={(value) => update('payTo', value)} />
      </fieldset>
      {serverError ? <p className="form-error form-error--summary" role="alert">{serverError}</p> : null}
      <button className="button button--primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? '생성 중…' : 'DRAFT Version 생성'}
      </button>
    </form>
  )
}

interface FieldProps {
  error?: string
  id: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  label: string
  onChange: (value: string) => void
  value: string
}

function Field({ error, id, inputMode, label, onChange, value }: FieldProps) {
  const errorId = `${id}-error`
  return (
    <div className="form-field">
      <label htmlFor={id}>{label} <span aria-hidden="true">*</span></label>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        id={id}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      {error ? <p className="form-error" id={errorId}>{error}</p> : null}
    </div>
  )
}
