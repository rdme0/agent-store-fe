import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { QuoteSnapshot } from '../entities/dependency/model'
import { getExecution } from '../entities/execution/api'
import { toExecutionModel } from '../entities/execution/model'
import { ExecutionResult } from '../features/execution/ExecutionResult'
import { ExecutionJourney } from '../features/execution/ExecutionJourney'
import type { DependencyEdgeViewModel, DependencyNodeViewModel } from '../features/dependencies/DependencyGraph'
import { ProviderSelectionProof } from '../features/dependencies/ProviderSelectionProof'
import { useExecutionEvents } from '../features/execution/useExecutionEvents'
import { useDisplayMode } from '../app/DisplayModeContext'
import { hasRenderableExecutionOutput } from './executionOutput'
import { ApiRequestError } from '../shared/api/client'
import { ApiErrorDetails } from '../shared/ui/ApiErrorDetails'
import { paymentFailureMessage } from '../features/execution/paymentPresentation'

const DependencyGraphPanel = lazy(() => import('../features/dependencies/DependencyGraph').then((module) => ({ default: module.DependencyGraphPanel })))

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return paymentFailureMessage(error.errorCode) ?? error.message
  return error instanceof Error ? error.message : '실행 정보를 불러오지 못했습니다.'
}

function quotedGraph(snapshot: QuoteSnapshot | undefined): { edges: DependencyEdgeViewModel[]; nodes: DependencyNodeViewModel[] } | undefined {
  if (!snapshot) return undefined
  const nodes = new Map<string, DependencyNodeViewModel>()
  const edges: DependencyEdgeViewModel[] = []
  const visited = new Set<string>()

  function visit(node: QuoteSnapshot) {
    if (visited.has(node.version.id)) return
    visited.add(node.version.id)
    nodes.set(node.version.id, { id: node.version.id, label: node.version.agentName ?? node.version.agentCode })
    node.dependencies.forEach((dependency) => {
      const targetId = dependency.resolved?.version.id ?? dependency.selection?.functionContractId ?? dependency.dependencyId
      nodes.set(targetId, {
        id: targetId,
        label: dependency.resolved?.version.agentName ?? dependency.resolved?.version.agentCode ?? dependency.selection?.functionCode ?? '선택되지 않은 공급자',
        optional: !dependency.required,
      })
      edges.push({
        id: dependency.dependencyId,
        label: dependency.selection?.strategy ?? dependency.versionConstraint,
        optional: !dependency.required,
        source: node.version.id,
        target: targetId,
      })
      if (dependency.resolved) visit(dependency.resolved)
    })
  }

  visit(snapshot)
  return { edges, nodes: [...nodes.values()] }
}

function executionRootStep(execution: Awaited<ReturnType<typeof getExecution>>) {
  return execution.steps.find((step) => !step.parentStepId)
}

function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia?.('(max-width: 700px)').matches ?? false)

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 700px)')
    if (!media) return

    function onChange(event: MediaQueryListEvent) {
      setNarrow(event.matches)
    }

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return narrow
}

export function ExecutionPage() {
  const { displayMode } = useDisplayMode()
  const { id = '' } = useParams<{ id: string }>()
  const executionQuery = useQuery({
    queryKey: ['execution', id],
    queryFn: ({ signal }) => getExecution(id, signal),
    enabled: Boolean(id),
    retry: false,
  })
  const refetch = executionQuery.refetch
  const refresh = useCallback(() => refetch({ cancelRefetch: false }), [refetch])
  if (executionQuery.isPending) {
    return <p className="state-card">실행 정보를 불러오는 중이에요.</p>
  }
  if (executionQuery.isError && !executionQuery.data) {
    return (
      <div className="state-card state-card--error" role="alert">
        <h1>실행 정보를 불러오지 못했습니다.</h1>
        <p>{errorMessage(executionQuery.error)}</p>
        <ApiErrorDetails error={executionQuery.error} showErrorCode={displayMode === 'developer'} />
        <button className="button button--secondary" onClick={() => void executionQuery.refetch()} type="button">다시 시도</button>
      </div>
    )
  }

  return (
    <ExecutionPageContent
      key={id}
      execution={executionQuery.data!}
      displayMode={displayMode}
      refetch={refresh}
      refreshError={executionQuery.error}
      refreshing={executionQuery.isFetching}
    />
  )
}

interface ExecutionPageContentProps {
  displayMode: 'easy' | 'developer'
  execution: Awaited<ReturnType<typeof getExecution>>
  refetch: () => Promise<unknown>
  refreshError: unknown
  refreshing: boolean
}

function ExecutionPageContent({ displayMode, execution, refetch, refreshError, refreshing }: ExecutionPageContentProps) {
  const { setDisplayMode } = useDisplayMode()
  const refreshOwner = useRef(false)
  const mounted = useRef(true)
  const [copyMessage, setCopyMessage] = useState('')
  const [tradeOpen, setTradeOpen] = useState(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  async function refreshStatus() {
    if (refreshOwner.current) return
    refreshOwner.current = true
    try { await refetch() } finally { refreshOwner.current = false }
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      if (mounted.current) setCopyMessage('실행 링크를 복사했어요.')
    } catch {
      if (mounted.current) setCopyMessage('복사하지 못했어요. 브라우저 주소를 복사해 주세요.')
    }
  }
  const narrowViewport = useNarrowViewport()
  const connection = useExecutionEvents({
    executionId: execution.id,
    refetch,
    terminal: execution.status === 'COMPLETED' || execution.status === 'FAILED',
  })
  const model = toExecutionModel(execution)
  const quoteSnapshot = execution.quoteSnapshot
  const persistedGraph = useMemo(() => quotedGraph(quoteSnapshot), [quoteSnapshot])
  const rootStep = executionRootStep(execution)
  const hasRootOutput = execution.status === 'COMPLETED' && hasRenderableExecutionOutput(rootStep?.output)
  const stepById = new Map(execution.steps.map((step) => [step.id, step]))
  const graphNodes = execution.steps.map((step) => ({
    id: step.id,
    label: `${step.agentName ?? step.agentCode ?? '분석 단계'} · ${step.status}`,
    description: step.failureCode ?? step.costAtomic,
  }))
  const graphEdges = execution.steps.flatMap((step) => step.parentStepId && stepById.has(step.parentStepId) && stepById.has(step.id)
    ? [{ id: `${step.parentStepId}-${step.id}`, source: step.parentStepId, target: step.id, label: 'runtime call' }]
    : [])
  const reconciliationRequired = execution.steps.some((step) => (
    step.failureCode === 'PAYMENT_RECONCILIATION_REQUIRED'
    || step.failureCode === 'PAYMENT_LOOKUP_REQUIRED'
    || step.payments.some((payment) => payment.status === 'RECONCILIATION_REQUIRED')
  ))

  const partialSteps = execution.steps.filter((step) => step.parentStepId && step.status === 'COMPLETED' && hasRenderableExecutionOutput(step.output))
  const recoveryControls = <div className="execution-page__recovery">
    <button className="button button--secondary" disabled={refreshing} onClick={() => void refreshStatus()} type="button">{refreshing ? '상태 확인 중…' : '상태 다시 확인'}</button>
    <button className="button button--quiet" onClick={() => void copyLink()} type="button">이 실행 링크 복사</button>
    <span role="status">{copyMessage}</span>
    {refreshError ? <div role="alert"><p>상태를 새로 불러오지 못했어요. 마지막으로 확인한 정보를 표시하고 있습니다.</p><ApiErrorDetails error={refreshError} showErrorCode={displayMode === 'developer'} /></div> : null}
  </div>
  const paymentNotice = reconciliationRequired ? <div className="state-card state-card--warning" role="status"><h2>결제 상태를 확인하고 있어요.</h2><p>결제 확인 중이라 결과를 확정하지 못했어요. 확인이 끝날 때까지 <strong>다시 결제하지 마세요.</strong> 이 링크로 나중에 상태를 확인할 수 있어요.</p>{recoveryControls}</div> : null
  const partialResults = (execution.status === 'FAILED' || reconciliationRequired) && partialSteps.length ? <section className="execution-page__output" aria-labelledby="partial-output-title"><h2 id="partial-output-title">완료된 단계의 결과</h2><p>전체 분석의 최종 답변은 아닙니다. 정상적으로 완료된 단계의 결과만 표시합니다.</p>{partialSteps.map((step) => <section key={step.id}><h3>{step.agentName ?? '완료된 분석 단계'}</h3><ExecutionResult output={step.output} responseFormat={step.responseFormat} /></section>)}</section> : null
  const missingOutput = !reconciliationRequired && !hasRootOutput && execution.status === 'COMPLETED' ? <div className="state-card state-card--warning" role="status"><h2>완료된 실행에 답변이 없어요.</h2><p>서버에서 최종 답변이 반환되지 않았습니다. 상태를 다시 확인하거나 개발자 상세에서 실행 기록을 확인해 주세요.</p>{recoveryControls}{displayMode === 'easy' ? <button className="button button--quiet" onClick={() => setDisplayMode('developer')} type="button">개발자 상세 보기</button> : null}</div> : null

  if (displayMode === 'easy') {
    const amountWon = execution.actualCostKrwEstimate?.amountWon
    const focusMode = !reconciliationRequired && execution.status !== 'COMPLETED' && execution.status !== 'FAILED'
    const title = reconciliationRequired
      ? '결제를 확인하고 있어요'
      : execution.status === 'COMPLETED'
        ? '답변을 정리했어요'
        : execution.status === 'FAILED'
          ? '분석을 마치지 못했어요'
          : '분석하고 있어요'
    return (
      <section className={`registry-page execution-page execution-page--easy${focusMode ? ' execution-page--focus' : ''}`} aria-labelledby="execution-title">
        <Link className="back-link" to="/marketplace">← 다른 Agent 보기</Link>
        <div className="execution-page__hero">
          <p className="section-label">{focusMode ? '분석 진행 중' : '분석 결과'}</p>
          <h1 id="execution-title">{title}</h1>
          {focusMode ? <p>필요한 자료를 확인한 뒤, 한 번에 읽기 쉬운 답변으로 정리하고 있어요.</p> : null}
        </div>
        {execution.question ? <p className="execution-page__question"><strong>질문</strong>{execution.question}</p> : null}
        {paymentNotice}
        {!reconciliationRequired && execution.status === 'FAILED' ? <div className="state-card state-card--error" role="alert"><h2>분석을 마치지 못했어요.</h2>{execution.steps.filter((step) => step.status === 'FAILED').map((step) => <p key={step.id}>{step.agentName ?? '분석 단계'}: {paymentFailureMessage(step.failureCode) ?? '공급자가 분석을 완료하지 못했습니다.'}</p>)}{recoveryControls}</div> : null}
        {hasRootOutput && !reconciliationRequired && rootStep ? (
          <section className="execution-page__output" aria-labelledby="execution-output-title">
            <h2 id="execution-output-title">최종 답변</h2>
            <ExecutionResult output={rootStep.output} responseFormat={rootStep.responseFormat} />
          </section>
        ) : null}
        {partialResults}
        {missingOutput}
        <p className="easy-cost-summary">정산이 확인된 비용: {model.actualCostLabel}{amountWon ? <span>참고 환산 약 {amountWon}원</span> : null}{reconciliationRequired ? <span>확인 중인 결제는 포함되지 않을 수 있어요. 최종 비용은 아직 확정되지 않았습니다.</span> : null}</p>
        {focusMode ? recoveryControls : null}
        <details className="execution-page__journey-details" open={focusMode}>
          <summary>분석 단계 보기</summary>
          <ExecutionJourney displayMode="easy" execution={execution} quoteSnapshot={quoteSnapshot} />
        </details>
      </section>
    )
  }

  return (
    <section className="registry-page execution-page" aria-labelledby="execution-title">
      <div className="page-heading page-heading--compact">
        <div>
          <Link className="back-link" to="/marketplace">← Marketplace</Link>
          <p className="section-label">실행</p>
          <h1 id="execution-title">실행 상세</h1>
          <p className="agent-card__code">{execution.id}</p>
        </div>
      </div>
      {execution.question ? <p className="execution-page__question"><strong>질문</strong>{execution.question}</p> : null}
      <dl className="execution-page__costs" aria-label="실행 비용">
        <div><dt>승인 최대 비용</dt><dd>{model.maxBudgetLabel}</dd></div>
        <div><dt>정산이 확인된 비용</dt><dd>{model.actualCostLabel}</dd></div>
        <div><dt>예약된 비용</dt><dd>{model.reservedCostLabel}</dd></div>
      </dl>
      {paymentNotice}
      {!reconciliationRequired && !(execution.status === 'COMPLETED' && !hasRootOutput) ? recoveryControls : null}
      <ExecutionJourney displayMode="developer" execution={execution} quoteSnapshot={quoteSnapshot} />
      {hasRootOutput && !reconciliationRequired && rootStep ? (
        <section className="execution-page__output" aria-labelledby="execution-output-title">
          <h2 id="execution-output-title">최종 결과</h2>
          <ExecutionResult output={rootStep.output} responseFormat={rootStep.responseFormat} />
        </section>
      ) : null}
      {partialResults}
      {missingOutput}
      <details className="execution-page__trade-details" onToggle={(event) => setTradeOpen(event.currentTarget.open)}>
        <summary>거래 상세 보기</summary>
        {tradeOpen ? <Suspense fallback={<p role="status">거래 상세를 불러오고 있어요.</p>}><div className="execution-page__trade-details-content">
          {!narrowViewport && persistedGraph ? (
            <DependencyGraphPanel
              costSummary={{ budget: model.maxBudgetLabel }}
              edges={persistedGraph.edges}
              nodes={persistedGraph.nodes}
              state="ready"
              title="Quote에 고정된 거래 그래프"
            />
          ) : null}
          {quoteSnapshot ? <ProviderSelectionProof snapshot={quoteSnapshot} /> : null}
          {!narrowViewport ? (
            <DependencyGraphPanel
              costSummary={{ budget: model.maxBudgetLabel }}
              edges={graphEdges}
              nodes={graphNodes}
              state={graphNodes.length > 0 ? 'ready' : 'empty'}
              title="실시간 의존성 그래프"
            />
          ) : <p className="state-card">모바일에서는 거래 그래프 대신 아래 실행 기록을 확인할 수 있어요.</p>}
          <p className="state-card" role="status">실시간 연결 상태: {connection === 'connected' ? '연결됨' : connection}</p>
        </div></Suspense> : null}
      </details>
    </section>
  )
}
