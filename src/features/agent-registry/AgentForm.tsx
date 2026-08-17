import { useState, type FormEvent, type ReactElement, type ReactNode } from 'react'
import { DEMO_DEVELOPER_ID } from '../../shared/config/env'
import type { RegisterAgentInput } from '../../entities/agent/api'
import { validateAgent, type FieldErrors, type VersionFormValues } from './validation'

interface AgentFormProps {
  isSubmitting: boolean
  serverError?: string
  onSubmit: (input: RegisterAgentInput) => void
}

const initialValues: VersionFormValues & {
  developerId: string
  slug: string
  name: string
  description: string
} = {
  developerId: DEMO_DEVELOPER_ID,
  slug: '',
  name: '',
  description: '',
  semver: '1.0.0',
  endpoint: 'http://localhost:8090/agents/demo',
  priceAtomic: '10000',
  network: 'eip155:84532',
  asset: 'USDC',
  payTo: '',
}

export function AgentForm({ isSubmitting, onSubmit, serverError }: AgentFormProps) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<FieldErrors>({})

  function update(key: keyof typeof initialValues, value: string) {
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
    const nextErrors = validateAgent(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit(values)
  }

  return (
    <form className="registry-form" onSubmit={submit} noValidate>
      <fieldset disabled={isSubmitting}>
        <legend>Agent 기본 정보</legend>
        <div className="form-grid">
          <FormField error={errors.developerId} label="Developer ID" required>
            <input
              aria-describedby={errors.developerId ? 'developerId-error' : undefined}
              aria-invalid={Boolean(errors.developerId)}
              id="developerId"
              onChange={(event) => update('developerId', event.target.value)}
              value={values.developerId}
            />
          </FormField>
          <FormField error={errors.slug} label="Slug" required>
            <input
              aria-describedby={errors.slug ? 'slug-error' : undefined}
              aria-invalid={Boolean(errors.slug)}
              id="slug"
              onChange={(event) => update('slug', event.target.value)}
              placeholder="investment-agent"
              value={values.slug}
            />
          </FormField>
          <FormField error={errors.name} label="Agent 이름" required>
            <input
              aria-describedby={errors.name ? 'name-error' : undefined}
              aria-invalid={Boolean(errors.name)}
              id="name"
              onChange={(event) => update('name', event.target.value)}
              value={values.name}
            />
          </FormField>
        </div>
        <FormField error={errors.description} label="설명" required>
          <textarea
            aria-describedby={errors.description ? 'description-error' : undefined}
            aria-invalid={Boolean(errors.description)}
            id="description"
            onChange={(event) => update('description', event.target.value)}
            rows={4}
            value={values.description}
          />
        </FormField>
      </fieldset>

      <VersionFields errors={errors} isSubmitting={isSubmitting} update={update} values={values} />

      {serverError ? (
        <p className="form-error form-error--summary" role="alert">
          {serverError}
        </p>
      ) : null}
      <button className="button button--primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? '등록 중…' : 'DRAFT Agent 등록'}
      </button>
    </form>
  )
}

interface VersionFieldsProps {
  errors: FieldErrors
  isSubmitting: boolean
  update: (key: keyof typeof initialValues, value: string) => void
  values: typeof initialValues
}

function VersionFields({ errors, isSubmitting, update, values }: VersionFieldsProps) {
  return (
    <fieldset disabled={isSubmitting}>
      <legend>첫 번째 Version</legend>
      <div className="form-grid">
        <FormField error={errors.semver} label="SemVer" required>
          <input
            aria-describedby={errors.semver ? 'semver-error' : undefined}
            aria-invalid={Boolean(errors.semver)}
            id="semver"
            onChange={(event) => update('semver', event.target.value)}
            value={values.semver}
          />
        </FormField>
        <FormField error={errors.priceAtomic} label="가격 (atomic USDC)" required>
          <input
            aria-describedby={errors.priceAtomic ? 'priceAtomic-error' : undefined}
            aria-invalid={Boolean(errors.priceAtomic)}
            id="priceAtomic"
            inputMode="numeric"
            onChange={(event) => update('priceAtomic', event.target.value)}
            value={values.priceAtomic}
          />
        </FormField>
        <FormField error={errors.network} label="Network" required>
          <input
            aria-describedby={errors.network ? 'network-error' : undefined}
            aria-invalid={Boolean(errors.network)}
            id="network"
            onChange={(event) => update('network', event.target.value)}
            value={values.network}
          />
        </FormField>
        <FormField error={errors.asset} label="Asset" required>
          <input
            aria-describedby={errors.asset ? 'asset-error' : undefined}
            aria-invalid={Boolean(errors.asset)}
            id="asset"
            onChange={(event) => update('asset', event.target.value)}
            value={values.asset}
          />
        </FormField>
      </div>
      <FormField error={errors.endpoint} label="Endpoint" required>
        <input
          aria-describedby={errors.endpoint ? 'endpoint-error' : undefined}
          aria-invalid={Boolean(errors.endpoint)}
          id="endpoint"
          onChange={(event) => update('endpoint', event.target.value)}
          value={values.endpoint}
        />
      </FormField>
      <FormField error={errors.payTo} label="PayTo wallet" required>
        <input
          aria-describedby={errors.payTo ? 'payTo-error' : undefined}
          aria-invalid={Boolean(errors.payTo)}
          id="payTo"
          onChange={(event) => update('payTo', event.target.value)}
          value={values.payTo}
        />
      </FormField>
    </fieldset>
  )
}

interface FormFieldProps {
  children: ReactNode
  error?: string
  label: string
  required?: boolean
}

function FormField({ children, error, label, required }: FormFieldProps) {
  const inputId = (children as ReactElement<{ id?: string }>).props.id
  const errorId = `${inputId}-error`
  return (
    <div className="form-field">
      <label htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p className="form-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
