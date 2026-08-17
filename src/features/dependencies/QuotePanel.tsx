import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { AgentVersionModel } from '../../entities/agent/model'
import { createAgentQuote } from '../../entities/dependency/api'
import type { QuoteSnapshot } from '../../generated'
import { DependencyGraphPanel, type DependencyEdgeViewModel, type DependencyNodeViewModel } from './DependencyGraph'

interface QuotePanelProps {
  slug: string
  version: AgentVersionModel
}

function errorMessage(error: unknown): string {
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

export function QuotePanel({ slug, version }: QuotePanelProps) {
  const quoteQuery = useQuery({
    queryKey: ['quote', slug, version.id],
    queryFn: () => createAgentQuote(slug, { versionConstraint: version.semver }),
    enabled: false,
    retry: false,
    staleTime: 0,
  })
  const quote = quoteQuery.data
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
      <p className="detail-description">실행은 다음 Phase에서 연결됩니다. 먼저 resolved dependency와 최대 비용을 확인하세요.</p>
      <button
        className="button button--primary"
        disabled={quoteQuery.isFetching}
        onClick={() => { void quoteQuery.refetch() }}
        type="button"
      >
        {quoteQuery.isFetching ? 'Quote 발급 중…' : quote ? 'Quote 새로 발급' : 'Quote 발급'}
      </button>
      {quoteQuery.isError ? (
        <div className="state-card state-card--error quote-panel__error" role="alert">
          <p>{errorMessage(quoteQuery.error)}</p>
          <button className="button button--secondary" onClick={() => { void quoteQuery.refetch() }} type="button">다시 시도</button>
        </div>
      ) : null}
      {quote ? (
        <>
          <dl className="quote-panel__summary">
            <div><dt>Maximum cost</dt><dd>{quote.maxCostLabel}</dd></div>
            <div><dt>Expires</dt><dd>{new Date(quote.expiresAt).toLocaleString('ko-KR')}</dd></div>
            <div><dt>Quote ID</dt><dd>{quote.id}</dd></div>
          </dl>
          {graph ? (
            <DependencyGraphPanel
              costSummary={{ maxCost: quote.maxCostLabel }}
              edges={graph.edges}
              nodes={graph.nodes}
              optionalDependencyWarning={optionalWarning}
              title="Quoted dependency graph"
            />
          ) : null}
        </>
      ) : null}
    </section>
  )
}
