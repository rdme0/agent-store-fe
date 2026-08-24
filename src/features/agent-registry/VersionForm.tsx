import { useState, type FormEvent, type HTMLAttributes } from 'react'
import { RESPONSE_FORMAT_OPTIONS, type AgentResponseFormat } from '../../entities/agent/model'
import type { CreateVersionInput } from '../../entities/agent/api'
import type { FunctionContractResponse } from '../../generated'
import { validateVersion, type FieldErrors, type VersionFormValues } from './validation'

interface VersionFormProps {
  functionContracts?: FunctionContractResponse[]
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
  responseFormat: 'JSON',
}

export function VersionForm({ functionContracts = [], isSubmitting, onSubmit, serverError }: VersionFormProps) {
  const [values, setValues] = useState(initialValues)
  const [functionContractId, setFunctionContractId] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const selectedFunctionContract = functionContracts.find((contract) => contract.id === functionContractId)

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
    onSubmit({
      ...values,
      functionContractId: functionContractId || undefined,
      responseFormat: selectedFunctionContract?.responseFormat ?? values.responseFormat ?? 'JSON',
    })
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
        <div className="form-field">
          <label htmlFor="version-functionContract">기능 계약</label>
          <select
            id="version-functionContract"
            onChange={(event) => {
              const nextId = event.target.value
              setFunctionContractId(nextId)
              const contract = functionContracts.find((item) => item.id === nextId)
              if (contract) update('responseFormat', contract.responseFormat)
            }}
            value={functionContractId}
          >
            <option value="">특정 Agent 직접 호출</option>
            {functionContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.name} · {contract.code} v{contract.contractVersion}</option>)}
          </select>
          <p className="form-field__help">선택하면 이 Version은 해당 입출력 Schema를 구현하는 공급자로 등록됩니다.</p>
        </div>
        <div className="form-field">
          <label htmlFor="version-responseFormat">응답 형식 <span aria-hidden="true">*</span></label>
          <select disabled={Boolean(selectedFunctionContract)} id="version-responseFormat" onChange={(event) => update('responseFormat', event.target.value as AgentResponseFormat)} value={selectedFunctionContract?.responseFormat ?? values.responseFormat ?? 'JSON'}>
            {RESPONSE_FORMAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <p className="form-field__help">{RESPONSE_FORMAT_OPTIONS.find((option) => option.value === (values.responseFormat ?? 'JSON'))?.description}</p>
        </div>
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
