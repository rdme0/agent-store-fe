import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { importAgentManifest, validateAgentManifest } from '../entities/agent-manifest/api'
import type { AgentManifestValidationResponse } from '../generated'
import { DEMO_DEVELOPER_ID } from '../shared/config/env'

function initialContent(): string {
  return `apiVersion: agentstore/v1
agent:
  developerId: ${DEMO_DEVELOPER_ID}
  code: example-agent
  name: 예시 Agent
  description: 기능 계약에 맞는 결과를 제공합니다.
  version: 1.0.0
  usageType: internal_component
  function:
    code: example-function
    version: 1.0.0
  endpoint: http://127.0.0.1:8090/agents/example/invoke
  payment:
    priceAtomic: "1000"
    network: eip155:84532
    asset: USDC
    payTo: "0x0000000000000000000000000000000000000001"
dependencies: []
`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '매니페스트 요청을 처리하지 못했습니다.'
}

export function AgentManifestPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [content, setContent] = useState(initialContent)
  const [validation, setValidation] = useState<AgentManifestValidationResponse>()
  const [error, setError] = useState<string>()
  const requestGeneration = useRef(0)
  const requestLocked = useRef(false)
  const mounted = useRef(true)
  const validateMutation = useMutation({
    mutationFn: async ({ content: source, generation }: { content: string; generation: number }) => ({
      generation,
      validation: await validateAgentManifest(source),
    }),
    onSuccess: ({ generation, validation: result }) => {
      if (!mounted.current || generation !== requestGeneration.current) {
        return
      }
      setValidation(result)
    },
    onError: (mutationError, variables) => {
      if (!mounted.current || variables.generation !== requestGeneration.current) {
        return
      }
      setError(errorMessage(mutationError))
    },
    onSettled: () => {
      requestLocked.current = false
    },
  })
  const importMutation = useMutation({
    mutationFn: importAgentManifest,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agents'] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace-agents'] }),
        queryClient.invalidateQueries({ queryKey: ['function-contracts'] }),
      ])
      if (mounted.current) {
        navigate(`/agents/${result.agentCode}`)
      }
    },
    onError: (mutationError) => {
      if (mounted.current) {
        setError(errorMessage(mutationError))
      }
    },
    onSettled: () => {
      requestLocked.current = false
    },
  })

  useEffect(() => {
    return () => {
      mounted.current = false
      requestGeneration.current += 1
    }
  }, [])

  function changeContent(nextContent: string) {
    requestGeneration.current += 1
    setContent(nextContent)
    setValidation(undefined)
    setError(undefined)
  }

  function validate() {
    if (requestLocked.current || !content.trim()) {
      return
    }
    requestLocked.current = true
    const generation = requestGeneration.current + 1
    requestGeneration.current = generation
    setError(undefined)
    setValidation(undefined)
    validateMutation.mutate({ content, generation })
  }

  function importManifest() {
    if (requestLocked.current || !validation || !content.trim()) {
      return
    }
    requestLocked.current = true
    setError(undefined)
    importMutation.mutate(content)
  }

  const isSubmitting = validateMutation.isPending || importMutation.isPending
  return (
    <section className="registry-page registry-page--narrow" aria-labelledby="agent-manifest-title">
      <p className="eyebrow">Agent manifest</p>
      <h1 id="agent-manifest-title">매니페스트로 Agent 등록</h1>
      <p className="page-placeholder__description">Agent의 기능 계약, 실행 주소, 결제 조건과 의존성을 하나의 YAML 선언으로 검토한 뒤 DRAFT로 등록합니다.</p>
      <div className="state-card">
        <p><strong>먼저 검증하고 등록하세요.</strong> 검증된 내용이 바뀌면 다시 검증해야 합니다.</p>
      </div>
      <label className="form-field" htmlFor="agent-manifest-content">
        <span>YAML 매니페스트</span>
        <textarea id="agent-manifest-content" onChange={(event) => changeContent(event.target.value)} rows={28} spellCheck={false} value={content} />
      </label>
      {validation ? <section className="state-card" aria-live="polite"><strong>검증 완료</strong><p>Agent 코드: {validation.agentCode}</p><p>기능 코드: {validation.functionCode}</p><p>선언 해시: <code>{validation.sha256}</code></p></section> : null}
      {error ? <p className="form-error form-error--summary" role="alert">{error}</p> : null}
      <div className="form-actions">
        <button className="button button--secondary" disabled={isSubmitting || !content.trim()} onClick={validate} type="button">{validateMutation.isPending ? '검증 중…' : '선언 검증'}</button>
        <button className="button button--primary" disabled={isSubmitting || !validation} onClick={importManifest} type="button">{importMutation.isPending ? '등록 중…' : 'DRAFT Agent 등록'}</button>
      </div>
    </section>
  )
}
