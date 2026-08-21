import { useEffect, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from 'react'
import { DEMO_DEVELOPER_ID } from '../../shared/config/env'
import type { RegisterAgentInput } from '../../entities/agent/api'
import { RESPONSE_FORMAT_OPTIONS, type AgentResponseFormat } from '../../entities/agent/model'
import { usdcToAtomic, validateAgent, validateUsdcAmount, type FieldErrors, type VersionFormValues } from './validation'

interface AgentFormProps { isSubmitting: boolean; serverError?: string; onSubmit: (input: RegisterAgentInput) => Promise<void> }

const initialValues: Omit<VersionFormValues, 'priceAtomic'> & { slug: string; name: string; description: string; priceUsdc: string } = {
  slug: '', name: '', description: '', semver: '1.0.0', endpoint: 'http://localhost:8090/agents/demo', priceUsdc: '0.01', network: 'eip155:84532', asset: 'USDC', payTo: '', responseFormat: 'JSON',
}
const fieldOrder = ['slug', 'name', 'description', 'semver', 'endpoint', 'priceUsdc', 'payTo'] as const

export function AgentForm({ isSubmitting, onSubmit, serverError }: AgentFormProps) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<FieldErrors>({})
  const submittingRef = useRef(false)
  const mountedRef = useRef(true)
  const inputRefs = useRef<Partial<Record<(typeof fieldOrder)[number], HTMLInputElement | HTMLTextAreaElement>>>({})

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  function update(key: keyof typeof initialValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function focusFirstInvalid(nextErrors: FieldErrors) {
    const firstInvalid = fieldOrder.find((field) => field in nextErrors)
    if (!firstInvalid) return
    const field = inputRefs.current[firstInvalid]
    field?.focus()
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current || isSubmitting) return
    const priceAtomic = usdcToAtomic(values.priceUsdc)
    const nextErrors = validateAgent({ ...values, developerId: DEMO_DEVELOPER_ID, priceAtomic: priceAtomic ?? '' })
    delete nextErrors.developerId
    delete nextErrors.priceAtomic
    const priceError = validateUsdcAmount(values.priceUsdc)
    if (priceError) nextErrors.priceUsdc = priceError
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(nextErrors)
      return
    }

    submittingRef.current = true
    try {
      await onSubmit({ developerId: DEMO_DEVELOPER_ID, slug: values.slug, name: values.name, description: values.description, semver: values.semver, endpoint: values.endpoint, priceAtomic: priceAtomic!, network: values.network, asset: values.asset, payTo: values.payTo, responseFormat: values.responseFormat ?? 'JSON' })
    } finally {
      if (mountedRef.current) {
        submittingRef.current = false
      }
    }
  }

  return (
    <form className="registry-form registry-form--grouped" onSubmit={(event) => void submit(event)} noValidate>
      {Object.keys(errors).length > 0 ? <div className="form-error form-error--summary" role="alert"><strong>입력 내용을 확인하세요.</strong><p>필수 항목과 입력 형식을 다시 확인한 뒤 등록해 주세요.</p></div> : null}
      <fieldset className="registry-form__section" disabled={isSubmitting}>
        <legend>기본 정보</legend><p className="registry-form__section-description">Marketplace에 표시될 Agent 정보를 입력해 주세요.</p>
        <div className="form-grid">
          <FormField error={errors.slug} label="Agent 주소" required help="영문 소문자, 숫자, 하이픈만 사용합니다. 예: investment-agent"><input ref={(element) => { inputRefs.current.slug = element ?? undefined }} aria-describedby={errors.slug ? 'slug-error' : undefined} aria-invalid={Boolean(errors.slug)} id="slug" onChange={(event) => update('slug', event.target.value)} placeholder="investment-agent" value={values.slug} /></FormField>
          <FormField error={errors.name} label="Agent 이름" required help="사용자에게 보여줄 이름입니다."><input ref={(element) => { inputRefs.current.name = element ?? undefined }} aria-describedby={errors.name ? 'name-error' : undefined} aria-invalid={Boolean(errors.name)} id="name" onChange={(event) => update('name', event.target.value)} placeholder="Investment Agent" value={values.name} /></FormField>
        </div>
        <FormField error={errors.description} label="설명" required help="어떤 요청을 처리하고 어떤 결과를 주는지 간단히 설명해 주세요."><textarea ref={(element) => { inputRefs.current.description = element ?? undefined }} aria-describedby={errors.description ? 'description-error' : undefined} aria-invalid={Boolean(errors.description)} id="description" onChange={(event) => update('description', event.target.value)} placeholder="시장·뉴스·위험 정보를 종합해 투자 관점을 정리합니다." rows={4} value={values.description} /></FormField>
      </fieldset>
      <fieldset className="registry-form__section" disabled={isSubmitting}>
        <legend>실행 endpoint와 Version</legend><p className="registry-form__section-description">등록 후 이 Version은 DRAFT 상태로 저장됩니다.</p>
        <div className="form-grid">
          <FormField error={errors.semver} label="Version" required help="Semantic Version 형식입니다. 예: 1.0.0"><input ref={(element) => { inputRefs.current.semver = element ?? undefined }} aria-describedby={errors.semver ? 'semver-error' : undefined} aria-invalid={Boolean(errors.semver)} id="semver" onChange={(event) => update('semver', event.target.value)} value={values.semver} /></FormField>
          <FormField error={errors.endpoint} label="Agent endpoint" required help="AgentStore가 실행 요청을 보낼 HTTPS 또는 개발용 HTTP 주소입니다."><input ref={(element) => { inputRefs.current.endpoint = element ?? undefined }} aria-describedby={errors.endpoint ? 'endpoint-error' : undefined} aria-invalid={Boolean(errors.endpoint)} id="endpoint" onChange={(event) => update('endpoint', event.target.value)} placeholder="https://example.com/agents/investment" value={values.endpoint} /></FormField>
        </div>
        <ResponseFormatField value={values.responseFormat ?? 'JSON'} onChange={(value) => update('responseFormat', value)} />
      </fieldset>
      <fieldset className="registry-form__section" disabled={isSubmitting}>
        <legend>가격과 결제 정보</legend><p className="registry-form__section-description">결제 network와 asset은 현재 테스트 환경의 Base Sepolia·USDC로 고정됩니다.</p>
        <div className="form-grid">
          <FormField error={errors.priceUsdc} inputId="priceUsdc" label="호출 가격" required help={`API 전송값: ${usdcToAtomic(values.priceUsdc) ?? '입력 형식 확인 필요'} atomic`}><div className="input-with-suffix"><input ref={(element) => { inputRefs.current.priceUsdc = element ?? undefined }} aria-describedby={errors.priceUsdc ? 'priceUsdc-error' : undefined} aria-invalid={Boolean(errors.priceUsdc)} id="priceUsdc" inputMode="decimal" onChange={(event) => update('priceUsdc', event.target.value)} value={values.priceUsdc} /><span aria-hidden="true">USDC</span></div></FormField>
          <div className="form-field form-field--preset"><span className="form-field__label">결제 network</span><strong>Base Sepolia</strong><span className="form-field__help">eip155:84532</span></div>
          <div className="form-field form-field--preset"><span className="form-field__label">결제 asset</span><strong>테스트 USDC</strong><span className="form-field__help">USDC</span></div>
        </div>
        <FormField error={errors.payTo} label="수익 수령 지갑" required help="0x로 시작하는 EVM 지갑 주소입니다. 결제 수익이 이 주소로 정산됩니다."><input ref={(element) => { inputRefs.current.payTo = element ?? undefined }} aria-describedby={errors.payTo ? 'payTo-error' : undefined} aria-invalid={Boolean(errors.payTo)} id="payTo" onChange={(event) => update('payTo', event.target.value)} placeholder="0x0000000000000000000000000000000000000000" value={values.payTo} /></FormField>
      </fieldset>
      {serverError ? <p className="form-error form-error--summary" role="alert">{serverError}</p> : null}
      <button className="button button--primary" disabled={isSubmitting} type="submit">{isSubmitting ? '등록 중…' : 'Agent 등록'}</button>
    </form>
  )
}

function ResponseFormatField({ value, onChange }: { value: AgentResponseFormat; onChange: (value: AgentResponseFormat) => void }) {
  return (
    <div className="form-field">
      <label htmlFor="responseFormat">응답 형식 <span aria-hidden="true">*</span></label>
      <select id="responseFormat" onChange={(event) => onChange(event.target.value as AgentResponseFormat)} value={value}>
        {RESPONSE_FORMAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <p className="form-field__help">{RESPONSE_FORMAT_OPTIONS.find((option) => option.value === value)?.description}</p>
    </div>
  )
}

interface FormFieldProps { children: ReactNode; error?: string; help?: string; inputId?: string; label: string; required?: boolean }
function FormField({ children, error, help, inputId: explicitInputId, label, required }: FormFieldProps) {
  const inputId = explicitInputId ?? (children as ReactElement<{ id?: string }>).props.id
  const errorId = `${inputId}-error`
  return <div className="form-field"><label htmlFor={inputId}>{label}{required ? <span aria-hidden="true"> *</span> : null}</label>{children}{help ? <p className="form-field__help">{help}</p> : null}{error ? <p className="form-error" id={errorId}>{error}</p> : null}</div>
}
