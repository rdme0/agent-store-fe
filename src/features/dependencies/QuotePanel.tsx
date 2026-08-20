import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AgentVersionModel } from '../../entities/agent/model'
import { createAgentQuote } from '../../entities/dependency/api'
import { createExecution } from '../../entities/execution/api'
import type { QuoteSnapshot } from '../../generated'
import { ApiRequestError } from '../../shared/api/client'
import { paymentFailureMessage } from '../execution/paymentPresentation'
import { DependencyGraphPanel, type DependencyEdgeViewModel, type DependencyNodeViewModel } from './DependencyGraph'

interface QuotePanelProps {
  slug: string
  version: AgentVersionModel
}

type RequestLockToken = symbol

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return paymentFailureMessage(error.errorCode) ?? error.message
  return error instanceof Error ? error.message : 'Quote를 발급하지 못했습니다.'
}

function flattenSnapshot(root: QuoteSnapshot): { edges: DependencyEdgeViewModel[]; nodes: DependencyNodeViewModel[] } {
  const nodes = new Map<string, DependencyNodeViewModel>([[root.version.agentId, { id: root.version.agentId, label: root.version.agentSlug }]])
  const edges: DependencyEdgeViewModel[] = []
  const visited = new Set<string>()
  function visit(snapshot: QuoteSnapshot) {
    if (visited.has(snapshot.version.id)) return
    visited.add(snapshot.version.id)
    for (const dependency of snapshot.dependencies) {
      nodes.set(dependency.targetAgentId, {
        id: dependency.targetAgentId,
        label: dependency.targetAgentSlug,
        optional: !dependency.required,
      })
      edges.push({
        id: dependency.dependencyId,
        label: `${dependency.versionConstraint} · ${dependency.maxCalls} call${dependency.maxCalls === 1 ? '' : 's'}`,
        optional: !dependency.required,
        source: snapshot.version.agentId,
        target: dependency.targetAgentId,
      })
      if (dependency.resolved) visit(dependency.resolved)
    }
  }
  visit(root)
  return { edges, nodes: [...nodes.values()] }
}

export function QuotePanel(props: QuotePanelProps) {
  return <QuotePanelForIdentity key={`${props.slug}:${props.version.id}`} {...props} />
}

function QuotePanelForIdentity({ slug, version }: QuotePanelProps) {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [approved, setApproved] = useState(false)
  const [quoteExpired, setQuoteExpired] = useState(false)
  const [requestLocked, setRequestLocked] = useState(false)
  const quoteGeneration = useRef(0)
  const requestLockOwner = useRef<RequestLockToken | undefined>(undefined)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      quoteGeneration.current += 1
      requestLockOwner.current = undefined
    }
  }, [])
  const acquireRequestLock = () => {
    if (requestLockOwner.current) return undefined
    const token = Symbol('quote-execution-request')
    requestLockOwner.current = token
    setRequestLocked(true)
    return token
  }
  const releaseRequestLock = (token: RequestLockToken) => {
    if (requestLockOwner.current !== token) return
    requestLockOwner.current = undefined
    if (mounted.current) setRequestLocked(false)
  }
  const executionMutation = useMutation({
    mutationFn: async ({
      generation,
      input,
      lockToken,
      snapshot,
    }: {
      generation: number
      input: Parameters<typeof createExecution>[0]
      lockToken: RequestLockToken
      snapshot: QuoteSnapshot
    }) => ({ execution: await createExecution(input), generation, lockToken, snapshot }),
    onSuccess: ({ execution, generation, snapshot }) => {
      if (!mounted.current || generation !== quoteGeneration.current) return
      navigate(`/runs/${execution.id}`, {
        state: { quoteSnapshot: snapshot },
      })
    },
    onError: (error, variables) => {
      if (!mounted.current || variables.generation !== quoteGeneration.current) return
      if (error instanceof ApiRequestError && (error.errorCode === 'QUOTE_409_001' || error.errorCode === 'QUOTE_EXPIRED')) {
        setQuoteExpired(true)
        setApproved(false)
      }
    },
    onSettled: (_data, _error, variables) => releaseRequestLock(variables.lockToken),
  })
  const quoteQuery = useQuery({
    queryKey: ['quote', slug, version.id],
    queryFn: async () => {
      const nextQuote = await createAgentQuote(slug, { versionConstraint: version.semver })
      if (mounted.current) {
        executionMutation.reset()
        setApproved(false)
        setQuoteExpired(new Date(nextQuote.expiresAt).getTime() <= Date.now())
      }
      return nextQuote
    },
    enabled: false,
    retry: false,
    staleTime: 0,
  })
  const quote = quoteQuery.data
  const requestQuote = async () => {
    if (executionMutation.isPending || quoteQuery.isFetching) return
    const lockToken = acquireRequestLock()
    if (!lockToken) return
    quoteGeneration.current += 1
    executionMutation.reset()
    setApproved(false)
    try {
      await quoteQuery.refetch()
    } finally {
      releaseRequestLock(lockToken)
    }
  }
  const graph = useMemo(() => quote ? flattenSnapshot(quote.snapshot) : undefined, [quote])
  const optionalWarning = quote?.warnings.length
    ? `Optional dependency ${quote.warnings.map((warning) => warning.targetAgentSlug).join(', ')}를 resolve하지 못했습니다.`
    : undefined

  return (
    <section className="quote-panel" aria-labelledby={`quote-${version.id}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Execution preparation</p>
          <h2 id={`quote-${version.id}`}>실행 전 Maximum Cost 확인</h2>
        </div>
        <span>Quote</span>
      </div>
      <p className="detail-description">Resolved dependency와 Maximum Cost를 확인한 뒤 질문을 입력하고 실행을 승인하세요.</p>
      <button
        className="button button--primary"
        disabled={requestLocked || quoteQuery.isFetching || executionMutation.isPending}
        onClick={() => { void requestQuote() }}
        type="button"
      >
        {quoteQuery.isFetching ? 'Quote 발급 중…' : quote ? 'Quote 새로 발급' : 'Quote 발급'}
      </button>
      {quoteQuery.isError ? (
        <div className="state-card state-card--error quote-panel__error" role="alert">
          <p>{errorMessage(quoteQuery.error)}</p>
          <button
            className="button button--secondary"
            disabled={requestLocked || quoteQuery.isFetching || executionMutation.isPending}
            onClick={() => { void requestQuote() }}
            type="button"
          >다시 시도</button>
        </div>
      ) : null}
      {quote ? (
        <>
          <dl className="quote-panel__summary">
            <div><dt>Maximum cost</dt><dd>{quote.maxCostLabel}</dd></div>
            <div><dt>Expires</dt><dd>{new Date(quote.expiresAt).toLocaleString('ko-KR')}</dd></div>
            <div><dt>Quote ID</dt><dd>{quote.id}</dd></div>
          </dl>
          {quoteExpired ? (
            <div className="state-card state-card--error quote-panel__error" role="alert">
              <p>Quote가 만료되었습니다. 새 Quote를 발급한 뒤 Maximum Cost를 다시 승인하세요.</p>
              <button className="button button--secondary" disabled={requestLocked || quoteQuery.isFetching || executionMutation.isPending} onClick={() => { void requestQuote() }} type="button">새 Quote 발급</button>
            </div>
          ) : null}
          {graph ? (
            <DependencyGraphPanel
              costSummary={{ maxCost: quote.maxCostLabel }}
              edges={graph.edges}
              nodes={graph.nodes}
              optionalDependencyWarning={optionalWarning}
              title="Quoted dependency graph"
            />
          ) : null}
          <form
            className="execution-approval"
            onSubmit={(event) => {
              event.preventDefault()
              const trimmedQuestion = question.trim()
              if (!trimmedQuestion || !approved || executionMutation.isPending || quoteQuery.isFetching) return
              if (quoteExpired || new Date(quote.expiresAt).getTime() <= Date.now()) {
                setQuoteExpired(true)
                return
              }
              const lockToken = acquireRequestLock()
              if (!lockToken) return
              try {
                executionMutation.mutate({
                  generation: quoteGeneration.current,
                  lockToken,
                  snapshot: quote.snapshot,
                  input: {
                    quoteId: quote.id,
                    maxBudgetAtomic: quote.maxCostAtomic,
                    question: trimmedQuestion,
                  },
                })
              } catch (error) {
                releaseRequestLock(lockToken)
                throw error
              }
            }}
          >
            <div className="form-field">
              <label htmlFor={`execution-question-${version.id}`}>Agent에게 물어볼 질문</label>
              <textarea
                id={`execution-question-${version.id}`}
                maxLength={4000}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="예: 최근 시장 상황을 바탕으로 투자 위험을 분석해줘"
                required
                rows={4}
                value={question}
              />
            </div>
            <label className="checkbox-field">
              <input
                checked={approved}
                disabled={quoteExpired || requestLocked || quoteQuery.isFetching || executionMutation.isPending}
                onChange={(event) => setApproved(event.target.checked)}
                type="checkbox"
              />
              <span>최대 {quote.maxCostLabel}까지 사용될 수 있음을 확인하고 실행을 승인합니다.</span>
            </label>
            {executionMutation.isError && !quoteExpired ? (
              <p className="form-error form-error--summary" role="alert">{errorMessage(executionMutation.error)}</p>
            ) : null}
            <button
              className="button button--primary"
              disabled={quoteExpired || !approved || !question.trim() || requestLocked || executionMutation.isPending || quoteQuery.isFetching}
              type="submit"
            >
              {executionMutation.isPending ? '실행을 시작하는 중…' : 'Maximum Cost 승인 후 실행'}
            </button>
          </form>
        </>
      ) : null}
    </section>
  )
}
