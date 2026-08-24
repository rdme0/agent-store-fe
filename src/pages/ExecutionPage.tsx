import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { QuoteSnapshot } from '../entities/dependency/model'
import { getExecution } from '../entities/execution/api'
import { toExecutionModel } from '../entities/execution/model'
import { ExecutionTimelinePanel } from '../features/execution/ExecutionTimeline'
import { ExecutionResult } from '../features/execution/ExecutionResult'
import { ExecutionJourney } from '../features/execution/ExecutionJourney'
import { DependencyGraphPanel, type DependencyEdgeViewModel, type DependencyNodeViewModel } from '../features/dependencies/DependencyGraph'
import { ProviderSelectionProof } from '../features/dependencies/ProviderSelectionProof'
import { executionSnapshotEvents, type StepLabelResolver } from '../features/execution/eventAdapter'
import { useExecutionEvents } from '../features/execution/useExecutionEvents'
import { useDisplayMode } from '../app/DisplayModeContext'

interface ExecutionLocationState {
  quoteSnapshot?: QuoteSnapshot
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '실행 정보를 불러오지 못했습니다.'
}

function collectVersionLabels(snapshot: QuoteSnapshot | undefined): Map<string, string> {
  const labels = new Map<string, string>()
  const visited = new Set<string>()
  function visit(node: QuoteSnapshot) {
    if (visited.has(node.version.id)) return
    visited.add(node.version.id)
    labels.set(node.version.id, node.version.agentSlug)
    node.dependencies.forEach((dependency) => {
      if (dependency.resolved) visit(dependency.resolved)
    })
  }
  if (snapshot) visit(snapshot)
  return labels
}

function quotedGraph(snapshot: QuoteSnapshot | undefined): { edges: DependencyEdgeViewModel[]; nodes: DependencyNodeViewModel[] } | undefined {
  if (!snapshot) return undefined
  const nodes = new Map<string, DependencyNodeViewModel>()
  const edges: DependencyEdgeViewModel[] = []
  const visited = new Set<string>()

  function visit(node: QuoteSnapshot) {
    if (visited.has(node.version.id)) return
    visited.add(node.version.id)
    nodes.set(node.version.id, { id: node.version.id, label: node.version.agentName ?? node.version.agentSlug })
    node.dependencies.forEach((dependency) => {
      const targetId = dependency.resolved?.version.id ?? dependency.selection?.functionContractId ?? dependency.dependencyId
      nodes.set(targetId, {
        id: targetId,
        label: dependency.resolved?.version.agentName ?? dependency.resolved?.version.agentSlug ?? dependency.selection?.functionCode ?? '선택되지 않은 공급자',
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
  const location = useLocation()
  const state = location.state as ExecutionLocationState | null
  const executionQuery = useQuery({
    queryKey: ['execution', id],
    queryFn: () => getExecution(id),
    enabled: Boolean(id),
    retry: false,
  })
  const snapshot = executionQuery.data?.quoteSnapshot ?? state?.quoteSnapshot
  const labels = useMemo(() => collectVersionLabels(snapshot), [snapshot])
  const labelForVersion: StepLabelResolver = useCallback(
    (versionId: string) => labels.get(versionId) ?? `Agent ${versionId.slice(0, 8)}`,
    [labels],
  )

  if (executionQuery.isPending) {
    return <ExecutionTimelinePanel state="loading" title="실행 상세" />
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
      labelForVersion={labelForVersion}
      onUpdate={executionQuery.refetch}
      snapshot={snapshot}
    />
  )
}

interface ExecutionPageContentProps {
  displayMode: 'easy' | 'developer'
  execution: Awaited<ReturnType<typeof getExecution>>
  labelForVersion: StepLabelResolver
  onUpdate: () => void
  snapshot?: QuoteSnapshot
}

function ExecutionPageContent({ displayMode, execution, labelForVersion, onUpdate, snapshot }: ExecutionPageContentProps) {
  const narrowViewport = useNarrowViewport()
  const snapshotEvents = useMemo(
    () => executionSnapshotEvents(execution, labelForVersion),
    [execution, labelForVersion],
  )
  const timeline = useExecutionEvents({
    executionId: execution.id,
    initialEvents: snapshotEvents,
    labelForVersion,
    onEvent: onUpdate,
  })
  const model = toExecutionModel(execution)
  const persistedGraph = useMemo(() => quotedGraph(snapshot), [snapshot])
  const rootStep = executionRootStep(execution)
  const stepById = new Map(timeline.steps.map((step) => [step.id, step]))
  const graphNodes = timeline.steps.map((step) => ({
    id: step.id,
    label: `${step.label} · ${step.status}`,
    description: step.error?.code ?? step.cost?.label,
  }))
  const graphEdges = execution.steps.flatMap((step) => step.parentStepId && stepById.has(step.parentStepId) && stepById.has(step.id)
    ? [{ id: `${step.parentStepId}-${step.id}`, source: step.parentStepId, target: step.id, label: 'runtime call' }]
    : [])
  const reconciliationRequired = execution.steps.some((step) => (
    step.payments.some((payment) => payment.status === 'RECONCILIATION_REQUIRED')
  )) || timeline.payment?.error?.code === 'PAYMENT_RECONCILIATION_REQUIRED'

  if (displayMode === 'easy') {
    const amountWon = execution.actualCostKrwEstimate?.amountWon
    const title = reconciliationRequired
      ? '결제를 확인하고 있어요'
      : execution.status === 'COMPLETED'
        ? '답변을 정리했어요'
        : execution.status === 'FAILED'
          ? '분석을 마치지 못했어요'
          : '분석하고 있어요'
    return (
      <section className="registry-page execution-page execution-page--easy" aria-labelledby="execution-title">
        <Link className="back-link" to="/">← 다른 Agent 보기</Link>
        <p className="section-label">분석 결과</p>
        <h1 id="execution-title">{title}</h1>
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
        <ExecutionJourney execution={execution} mode="easy" snapshot={snapshot} timeline={timeline} />
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
          <p className="agent-card__slug">{execution.id}</p>
        </div>
      </div>
      {execution.question ? <p className="execution-page__question"><strong>질문</strong>{execution.question}</p> : null}
      <dl className="execution-page__costs" aria-label="실행 비용">
        <div><dt>승인 최대 비용</dt><dd>{model.maxBudgetLabel}</dd></div>
        <div><dt>실제 사용 비용</dt><dd>{model.actualCostLabel}</dd></div>
        <div><dt>예약된 비용</dt><dd>{model.reservedCostLabel}</dd></div>
      </dl>
      <ExecutionJourney execution={execution} mode="developer" snapshot={snapshot} timeline={timeline} />
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
          {snapshot ? <ProviderSelectionProof snapshot={snapshot} /> : null}
          {!narrowViewport ? (
            <DependencyGraphPanel
              costSummary={{ budget: model.maxBudgetLabel }}
              edges={graphEdges}
              nodes={graphNodes}
              state={graphNodes.length > 0 ? 'ready' : 'empty'}
              title="실시간 의존성 그래프"
            />
          ) : <p className="state-card">모바일에서는 거래 그래프 대신 아래 실행 기록을 확인할 수 있어요.</p>}
          <ExecutionTimelinePanel state="ready" timeline={timeline} title="Agent 실행 흐름" />
        </div>
      </details>
    </section>
  )
}
