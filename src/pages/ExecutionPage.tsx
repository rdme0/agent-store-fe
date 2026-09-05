import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import type { QuoteSnapshot } from '../entities/dependency/model'
import { getExecution } from '../entities/execution/api'
import { toExecutionModel } from '../entities/execution/model'
import { ExecutionResult } from '../features/execution/ExecutionResult'
import { ExecutionJourney } from '../features/execution/ExecutionJourney'
import { DependencyGraphPanel, type DependencyEdgeViewModel, type DependencyNodeViewModel } from '../features/dependencies/DependencyGraph'
import { ProviderSelectionProof } from '../features/dependencies/ProviderSelectionProof'
import { useExecutionEvents } from '../features/execution/useExecutionEvents'
import { useDisplayMode } from '../app/DisplayModeContext'

function errorMessage(error: unknown): string {
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
    queryFn: () => getExecution(id),
    enabled: Boolean(id),
    retry: false,
  })
  if (executionQuery.isPending) {
    return <p className="state-card">실행 정보를 불러오는 중이에요.</p>
  }
  if (executionQuery.isError) {
    return (
      <div className="state-card state-card--error" role="alert">
        <h1>실행 정보를 불러오지 못했습니다.</h1>
        <p>{errorMessage(executionQuery.error)}</p>
        <button className="button button--secondary" onClick={() => void executionQuery.refetch()} type="button">다시 시도</button>
      </div>
    )
  }

  return (
    <ExecutionPageContent
      execution={executionQuery.data}
      displayMode={displayMode}
      refetch={executionQuery.refetch}
    />
  )
}

interface ExecutionPageContentProps {
  displayMode: 'easy' | 'developer'
  execution: Awaited<ReturnType<typeof getExecution>>
  refetch: () => Promise<unknown>
}

function ExecutionPageContent({ displayMode, execution, refetch }: ExecutionPageContentProps) {
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
    step.payments.some((payment) => payment.status === 'RECONCILIATION_REQUIRED')
  ))

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
        {reconciliationRequired ? (
          <p className="state-card state-card--warning" role="status">
            결제 확인 중이라 결과를 확정하지 못했어요. 확인이 끝날 때까지 다시 결제하지 마세요.
          </p>
        ) : null}
        {rootStep?.output !== undefined ? (
          <section className="execution-page__output" aria-labelledby="execution-output-title">
            <h2 id="execution-output-title">최종 답변</h2>
            <ExecutionResult output={rootStep.output} responseFormat={rootStep.responseFormat} />
          </section>
        ) : null}
        <ExecutionJourney displayMode="easy" execution={execution} quoteSnapshot={quoteSnapshot} />
        <p className="easy-cost-summary">{amountWon ? `총 약 ${amountWon}원 사용했어요.` : `총 ${model.actualCostLabel} 사용했어요.`} <span>{model.actualCostLabel}</span></p>
      </section>
    )
  }

  return (
    <section className="registry-page execution-page" aria-labelledby="execution-title">
      <div className="page-heading page-heading--compact">
        <div>
          <Link className="back-link" to="/agents">← Marketplace</Link>
          <p className="section-label">실행</p>
          <h1 id="execution-title">실행 상세</h1>
          <p className="agent-card__code">{execution.id}</p>
        </div>
      </div>
      {execution.question ? <p className="execution-page__question"><strong>질문</strong>{execution.question}</p> : null}
      <dl className="execution-page__costs" aria-label="실행 비용">
        <div><dt>승인 최대 비용</dt><dd>{model.maxBudgetLabel}</dd></div>
        <div><dt>실제 사용 비용</dt><dd>{model.actualCostLabel}</dd></div>
        <div><dt>예약된 비용</dt><dd>{model.reservedCostLabel}</dd></div>
      </dl>
      <ExecutionJourney displayMode="developer" execution={execution} quoteSnapshot={quoteSnapshot} />
      {rootStep?.output !== undefined ? (
        <section className="execution-page__output" aria-labelledby="execution-output-title">
          <h2 id="execution-output-title">최종 결과</h2>
          <ExecutionResult output={rootStep.output} responseFormat={rootStep.responseFormat} />
        </section>
      ) : execution.status === 'COMPLETED' ? (
        <p className="state-card">실행은 완료됐지만 반환된 결과가 없습니다.</p>
      ) : null}
      <details className="execution-page__trade-details">
        <summary>거래 상세 보기</summary>
        <div className="execution-page__trade-details-content">
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
        </div>
      </details>
    </section>
  )
}
