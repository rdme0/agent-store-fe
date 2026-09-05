import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  createFunctionContract,
  listFunctionContracts,
  listFunctionProviders,
} from '../entities/function-contract/api'
import type { FunctionContractResponse } from '../generated'
import { JsonCodeBlock } from '../shared/ui/JsonCodeBlock'
import { JsonEditor } from '../shared/ui/JsonEditor'

const inputSchemaExample = `{
  "type": "object",
  "properties": {
    "input": { "type": "object" },
    "question": { "type": "string" }
  },
  "required": ["input"]
}`

const outputSchemaExample = `{
  "type": "object"
}`

function FunctionContractDetail({ contract }: { contract: FunctionContractResponse }) {
  const providers = useQuery({
    queryKey: ['function-contract-providers', contract.id],
    queryFn: () => listFunctionProviders(contract.id),
  })
  return (
    <section className="function-contract-detail">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{contract.code}</p>
          <h2>{contract.name} · v{contract.contractVersion}</h2>
        </div>
        <span>{contract.responseFormat}</span>
      </div>
      <p>{contract.description}</p>
      <div className="function-contract-schema-grid">
        <div><h3>입력 계약</h3><JsonCodeBlock label="입력 계약 JSON" value={contract.inputSchema} /></div>
        <div><h3>출력 계약</h3><JsonCodeBlock label="출력 계약 JSON" value={contract.outputSchema} /></div>
      </div>
      <h3>ACTIVE 공급자</h3>
      {providers.isPending ? <p role="status">공급자를 불러오는 중…</p> : null}
      {providers.isError ? <div className="state-card state-card--error" role="alert"><p>{providers.error instanceof Error ? providers.error.message : '공급자를 불러오지 못했습니다.'}</p><button className="button button--secondary" onClick={() => void providers.refetch()} type="button">다시 시도</button></div> : null}
      {providers.isSuccess && providers.data.length === 0 ? <p className="state-card">아직 이 기능을 제공하는 ACTIVE Version이 없습니다.</p> : null}
      <div className="function-provider-list">
        {providers.data?.map((provider) => <article key={provider.versionId}><strong>{provider.agentName}</strong><span>{provider.agentCode} · v{provider.semver}</span><span>{provider.priceAtomic} atomic USDC</span><span>{provider.mature ? `신뢰도 ${provider.reliabilityPercent ?? '-'}% · p95 ${provider.p95LatencyMillis ?? '-'}ms` : '관측 데이터 수집 중'}</span></article>)}
      </div>
    </section>
  )
}

export function FunctionContractsPage() {
  const queryClient = useQueryClient()
  const contracts = useQuery({ queryKey: ['function-contracts'], queryFn: listFunctionContracts })
  const [selectedId, setSelectedId] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [step, setStep] = useState(0)
  const [review, setReview] = useState<Record<string, string>>({})
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const submitLocked = useRef(false)
  const mutation = useMutation({
    mutationFn: createFunctionContract,
    onSuccess: async (created) => {
      if (mounted.current) setSelectedId(created.id)
      await queryClient.invalidateQueries({ queryKey: ['function-contracts'] })
    },
    onSettled: () => {
      submitLocked.current = false
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitLocked.current) {
      return
    }
    const data = new FormData(event.currentTarget)
    const form = event.currentTarget
    const fields = step === 0 ? ['code', 'contractVersion', 'name', 'description'] : ['inputSchema', 'outputSchema']
    for (const name of fields) {
      const input = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement
      if (!input.checkValidity()) { input.reportValidity(); return }
    }
    try {
      const inputSchema = JSON.parse(String(data.get('inputSchema')))
      const outputSchema = JSON.parse(String(data.get('outputSchema')))
      setFormError(undefined)
      if (step < 2) {
        setReview(Object.fromEntries(Array.from(data.entries()).map(([key, value]) => [key, String(value)])))
        setStep(step + 1)
        return
      }
      submitLocked.current = true
      mutation.mutate({
        code: String(data.get('code')).trim(),
        contractVersion: String(data.get('contractVersion')).trim(),
        name: String(data.get('name')).trim(),
        description: String(data.get('description')).trim(),
        responseFormat: String(data.get('responseFormat')) as FunctionContractResponse['responseFormat'],
        inputSchema,
        outputSchema,
      })
    } catch {
      submitLocked.current = false
      setFormError('입출력 계약 JSON 문법을 확인하세요.')
      for (const name of ['inputSchema', 'outputSchema']) {
        try { JSON.parse(String(data.get(name))) } catch { (form.elements.namedItem(name) as HTMLTextAreaElement).focus(); break }
      }
    }
  }

  const selected = contracts.data?.find((contract) => contract.id === selectedId) ?? contracts.data?.[0]
  if (contracts.isPending) {
    return <p className="state-card" role="status">기능 계약을 불러오는 중…</p>
  }
  if (contracts.isError) {
    return <div className="state-card state-card--error" role="alert"><p>{contracts.error instanceof Error ? contracts.error.message : '기능 계약을 불러오지 못했습니다.'}</p><button className="button button--secondary" onClick={() => void contracts.refetch()} type="button">다시 시도</button></div>
  }
  return (
    <section className="registry-page" aria-labelledby="function-contracts-title">
      <p className="eyebrow">Function contracts</p>
      <h1 id="function-contracts-title">기능 계약</h1>
      <p className="page-placeholder__description">공급자가 같은 기능을 제공할 때 지켜야 할 입력·출력 약속입니다. 코드는 URL이 아니라 Marketplace에서 기능을 찾는 이름입니다.</p>
      {selected ? (
        <div className="function-contract-layout">
          <aside className="function-contract-list" aria-label="기능 계약 목록">
            {contracts.data?.map((contract) => <button className={selected.id === contract.id ? 'function-contract-list__item function-contract-list__item--active' : 'function-contract-list__item'} key={contract.id} onClick={() => setSelectedId(contract.id)} type="button"><strong>{contract.name}</strong><span>{contract.code} · v{contract.contractVersion}</span></button>)}
          </aside>
          <FunctionContractDetail contract={selected} />
        </div>
      ) : <p className="state-card function-contract-empty">등록된 기능 계약이 없습니다.</p>}
      <form className="registry-form function-contract-form" onSubmit={submit} noValidate>
        <ol className="form-steps" aria-label="기능 계약 등록 단계">{['기본 정보', '입출력 Schema', '최종 확인'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}>{index + 1}. {label}</li>)}</ol>
        <p role="status">{step + 1} / 3 단계</p>
        <fieldset disabled={mutation.isPending} hidden={step !== 0}>
          <legend>새 기능 계약</legend>
          <div className="form-grid">
            <label className="form-field">기능 코드<input name="code" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="stock-news-analysis" required /></label>
            <label className="form-field">계약 Version<input name="contractVersion" placeholder="1.0.0" required /></label>
            <label className="form-field">이름<input name="name" required /></label>
            <label className="form-field">응답 형식<select name="responseFormat" defaultValue="JSON"><option>TEXT</option><option>MARKDOWN</option><option>STRUCTURED</option><option>JSON</option></select></label>
          </div>
          <label className="form-field">설명<textarea name="description" required rows={3} /></label>
        </fieldset>
        <fieldset disabled={mutation.isPending} hidden={step !== 1}><legend>입출력 Schema</legend><p>JSON 문법은 여기에서 확인합니다. 계약 유효성은 등록 시 서버가 검증합니다.</p>
          <div className="function-contract-schema-grid">
            <JsonEditor defaultValue={inputSchemaExample} id="input-schema" label="입력 계약 Schema" name="inputSchema" required rows={12} />
            <JsonEditor defaultValue={outputSchemaExample} id="output-schema" label="출력 계약 Schema" name="outputSchema" required rows={12} />
          </div>
        </fieldset>
        {step === 2 ? <section className="form-review"><h2>기능 계약 등록 확인</h2><dl><dt>이름 · 코드</dt><dd>{review.name} · {review.code}</dd><dt>Version · 응답 형식</dt><dd>{review.contractVersion} · {review.responseFormat}</dd><dt>설명</dt><dd>{review.description}</dd></dl><details><summary>입출력 계약 확인</summary><pre>{review.inputSchema}</pre><pre>{review.outputSchema}</pre></details></section> : null}
        {formError || mutation.error ? <p className="form-error" role="alert">{formError ?? (mutation.error instanceof Error ? mutation.error.message : '기능 계약 생성에 실패했습니다.')}</p> : null}
        <div className="form-actions">{step > 0 ? <button className="button button--secondary" disabled={mutation.isPending} type="button" onClick={() => { setFormError(undefined); setStep(step - 1) }}>이전</button> : null}<button className="button button--primary" disabled={mutation.isPending} type="submit">{mutation.isPending ? '등록 중…' : step === 2 ? '계약 등록' : '다음'}</button></div>
      </form>
    </section>
  )
}
