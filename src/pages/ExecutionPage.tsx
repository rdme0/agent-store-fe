import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useCallback, useMemo } from 'react'
import type { QuoteSnapshot } from '../generated'
import { getExecution } from '../entities/execution/api'
import { toExecutionModel } from '../entities/execution/model'
import { ExecutionTimelinePanel } from '../features/execution/ExecutionTimeline'
import { DependencyGraphPanel } from '../features/dependencies/DependencyGraph'
import { executionSnapshotEvents, type StepLabelResolver } from '../features/execution/eventAdapter'
import { useExecutionEvents } from '../features/execution/useExecutionEvents'

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

function executionOutput(execution: Awaited<ReturnType<typeof getExecution>>): unknown {
  const root = execution.steps.find((step) => !step.parentStepId)
  return root?.output
}

export function ExecutionPage() {
  const { id = '' } = useParams<{ id: string }>()
  const location = useLocation()
  const state = location.state as ExecutionLocationState | null
  const labels = useMemo(() => collectVersionLabels(state?.quoteSnapshot), [state?.quoteSnapshot])
  const labelForVersion: StepLabelResolver = useCallback(
    (versionId: string) => labels.get(versionId) ?? `Agent ${versionId.slice(0, 8)}`,
    [labels],
  )
  const executionQuery = useQuery({
    queryKey: ['execution', id],
    queryFn: () => getExecution(id),
    enabled: Boolean(id),
    retry: false,
  })

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
      labelForVersion={labelForVersion}
      onUpdate={executionQuery.refetch}
    />
  )
}

interface ExecutionPageContentProps {
  execution: Awaited<ReturnType<typeof getExecution>>
  labelForVersion: StepLabelResolver
  onUpdate: () => void
}

function ExecutionPageContent({ execution, labelForVersion, onUpdate }: ExecutionPageContentProps) {
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
  const output = executionOutput(execution)
  const stepById = new Map(timeline.steps.map((step) => [step.id, step]))
  const graphNodes = timeline.steps.map((step) => ({
    id: step.id,
    label: `${step.label} · ${step.status}`,
    description: step.error?.code ?? step.cost?.label,
  }))
  const graphEdges = execution.steps.flatMap((step) => step.parentStepId && stepById.has(step.parentStepId) && stepById.has(step.id)
    ? [{ id: `${step.parentStepId}-${step.id}`, source: step.parentStepId, target: step.id, label: 'runtime call' }]
    : [])

  return (
    <section className="registry-page execution-page" aria-labelledby="execution-title">
      <div className="page-heading page-heading--compact">
        <div>
          <Link className="back-link" to="/agents">← Marketplace</Link>
          <p className="eyebrow">Execution</p>
          <h1 id="execution-title">실행 상세</h1>
          <p className="agent-card__slug">{execution.id}</p>
        </div>
      </div>
      {execution.question ? <p className="execution-page__question"><strong>질문</strong>{execution.question}</p> : null}
      <dl className="execution-page__costs" aria-label="실행 비용">
        <div><dt>Maximum Cost</dt><dd>{model.maxBudgetLabel}</dd></div>
        <div><dt>Actual Cost</dt><dd>{model.actualCostLabel}</dd></div>
        <div><dt>Reserved</dt><dd>{model.reservedCostLabel}</dd></div>
      </dl>
      <DependencyGraphPanel
        costSummary={{ budget: model.maxBudgetLabel }}
        edges={graphEdges}
        nodes={graphNodes}
        state={graphNodes.length > 0 ? 'ready' : 'empty'}
        title="실시간 dependency graph"
      />
      <ExecutionTimelinePanel state="ready" timeline={timeline} title="Agent 실행 흐름" />
      {output !== undefined ? (
        <section className="execution-page__output" aria-labelledby="execution-output-title">
          <h2 id="execution-output-title">최종 결과</h2>
          <pre>{typeof output === 'string' ? output : JSON.stringify(output, null, 2)}</pre>
        </section>
      ) : execution.status === 'COMPLETED' ? (
        <p className="state-card">실행은 완료됐지만 반환된 결과가 없습니다.</p>
      ) : null}
    </section>
  )
}
