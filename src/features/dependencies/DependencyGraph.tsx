import dagre from '@dagrejs/dagre'
import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useId, useState } from 'react'

export type DependencyGraphState = 'loading' | 'empty' | 'error' | 'disabled' | 'ready'

export interface DependencyNodeViewModel { id: string; label: string; description?: string; optional?: boolean; disabled?: boolean }
export interface DependencyEdgeViewModel { id?: string; source: string; target: string; label?: string; optional?: boolean; cycle?: boolean }
export interface DependencyCostSummary { maxCost?: string; budget?: string; currency?: string }
export interface DependencyGraphProps { nodes: readonly DependencyNodeViewModel[]; edges: readonly DependencyEdgeViewModel[]; title?: string; cyclePath?: readonly string[]; cycleEdgeIds?: readonly string[]; optionalDependencyWarning?: string; costSummary?: DependencyCostSummary }
export interface DependencyGraphPanelProps extends DependencyGraphProps { state?: DependencyGraphState; errorMessage?: string; disabledMessage?: string; onRetry?: () => void }

const NODE_WIDTH = 210
const NODE_HEIGHT = 72

function edgeIdentifier(edge: DependencyEdgeViewModel, index: number): string { return edge.id ?? `${edge.source}-${edge.target}-${index}` }

function normalizeCyclePath(cyclePath: readonly string[] | undefined): readonly string[] {
  if (!cyclePath?.length) return []
  const normalized = [...cyclePath]
  while (normalized.length > 1 && normalized.at(-1) === normalized[0]) normalized.pop()
  return normalized
}

function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia?.('(max-width: 700px)').matches ?? false)
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 700px)')
    if (!media) return
    const onChange = (event: MediaQueryListEvent) => setNarrow(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return narrow
}

function layoutGraph(nodes: readonly DependencyNodeViewModel[], edges: readonly DependencyEdgeViewModel[], cycleEdgeIds: ReadonlySet<string>): { edges: Edge[]; nodes: Node[] } {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ nodesep: 44, rankdir: 'LR', ranksep: 76 })
  nodes.forEach((node) => graph.setNode(node.id, { height: NODE_HEIGHT, width: NODE_WIDTH }))
  edges.forEach((edge, index) => graph.setEdge(edge.source, edge.target, { id: edgeIdentifier(edge, index) }))
  dagre.layout(graph)
  return {
    nodes: nodes.map((node) => {
      const position = graph.node(node.id)
      return { id: node.id, data: { label: node.label }, draggable: false, position: { x: position.x - NODE_WIDTH / 2, y: position.y - NODE_HEIGHT / 2 }, selectable: false, style: { opacity: node.disabled ? 0.52 : 1, width: NODE_WIDTH } }
    }),
    edges: edges.map((edge, index) => {
      const id = edgeIdentifier(edge, index)
      const cycle = edge.cycle ?? cycleEdgeIds.has(id)
      return { id, source: edge.source, target: edge.target, label: edge.label, selectable: false, style: cycle ? { stroke: '#b42318', strokeWidth: 2 } : undefined }
    }),
  }
}

function SemanticGraphList({ cycleEdgeIds, cycleNodeIds, edges, nodes }: Pick<DependencyGraphProps, 'edges' | 'nodes'> & { cycleEdgeIds: ReadonlySet<string>; cycleNodeIds: ReadonlySet<string> }) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  return <div className="dependency-graph__fallback"><h3>의존성 목록</h3><ul aria-label="의존성 노드" className="dependency-graph__nodes">{nodes.map((node) => {
    const nodeEdges = edges.map((edge, index) => ({ edge, index })).filter(({ edge }) => edge.source === node.id)
    return <li className={cycleNodeIds.has(node.id) ? 'dependency-graph__node dependency-graph__node--cycle' : 'dependency-graph__node'} key={node.id}><strong>{node.label}</strong>{node.description ? <p>{node.description}</p> : null}{nodeEdges.length ? <ul aria-label={`${node.label} 의존성`} className="dependency-graph__edges">{nodeEdges.map(({ edge, index }) => <li className={edge.cycle ?? cycleEdgeIds.has(edgeIdentifier(edge, index)) ? 'dependency-graph__edge-item dependency-graph__edge-item--cycle' : 'dependency-graph__edge-item'} key={edgeIdentifier(edge, index)}>{nodesById.get(edge.target)?.label ?? edge.target}{edge.label ? ` · ${edge.label}` : ''}</li>)}</ul> : <p className="dependency-graph__leaf">하위 의존성이 없습니다.</p>}</li>
  })}</ul></div>
}

export function DependencyGraph({ costSummary, cyclePath, cycleEdgeIds, edges, nodes, optionalDependencyWarning, title = '의존성' }: DependencyGraphProps) {
  const headingId = useId()
  const narrow = useNarrowViewport()
  const normalizedCyclePath = normalizeCyclePath(cyclePath)
  const cycleNodeIds = new Set(normalizedCyclePath)
  const cycleEdgeIdSet = new Set(cycleEdgeIds ?? [])
  const layout = layoutGraph(nodes, edges, cycleEdgeIdSet)
  const cycleLabels = normalizedCyclePath.map((id) => nodes.find((node) => node.id === id)?.label ?? id)
  const cycleText = cycleLabels.length > 1 ? [...cycleLabels, cycleLabels[0]].join(' → ') : cycleLabels.join('')
  return <section className="dependency-graph" aria-labelledby={headingId}>
    <div className="dependency-graph__header"><div><p className="card-kicker">의존성 그래프</p><h2 id={headingId}>{title}</h2></div><span className="dependency-graph__count">노드 {nodes.length}개 · 연결 {edges.length}개</span></div>
    {cycleText ? <p className="dependency-graph__notice dependency-graph__notice--cycle" role="alert"><strong>순환 의존성이 감지되었습니다.</strong> {cycleText}</p> : null}
    {optionalDependencyWarning ? <p className="dependency-graph__notice dependency-graph__notice--optional" role="note">{optionalDependencyWarning}</p> : null}
    {costSummary?.maxCost || costSummary?.budget ? <dl className="dependency-graph__summary" aria-label="의존성 비용 요약">{costSummary.maxCost ? <div><dt>최대 비용</dt><dd>{costSummary.currency ? `${costSummary.maxCost} ${costSummary.currency}` : costSummary.maxCost}</dd></div> : null}{costSummary.budget ? <div><dt>예산</dt><dd>{costSummary.currency ? `${costSummary.budget} ${costSummary.currency}` : costSummary.budget}</dd></div> : null}</dl> : null}
    {!narrow ? <div className="dependency-graph__flow" aria-label={`${title} 시각 그래프`}><ReactFlow edges={layout.edges} fitView fitViewOptions={{ padding: 0.2 }} maxZoom={1.5} minZoom={0.35} nodes={layout.nodes} nodesConnectable={false} nodesDraggable={false} nodesFocusable={false} panOnDrag zoomOnDoubleClick={false}><Background gap={16} /><Controls showInteractive={false} /></ReactFlow></div> : <p className="state-card">모바일에서는 카드 여정과 아래 목록으로 실행 경로를 확인할 수 있어요.</p>}
    <SemanticGraphList cycleEdgeIds={cycleEdgeIdSet} cycleNodeIds={cycleNodeIds} edges={edges} nodes={nodes} />
  </section>
}

export function DependencyGraphPanel({ disabledMessage = '의존성 실행이 현재 비활성화되어 있습니다.', errorMessage = '의존성 정보를 불러오지 못했습니다.', onRetry, state, ...graphProps }: DependencyGraphPanelProps) {
  const effectiveState = state ?? (graphProps.nodes.length ? 'ready' : 'empty')
  if (effectiveState === 'loading') return <div className="state-card dependency-graph-state" role="status"><h2>의존성 정보를 불러오는 중…</h2><p>의존성 그래프를 준비하고 있습니다.</p></div>
  if (effectiveState === 'empty') return <div className="state-card dependency-graph-state" role="status"><h2>등록된 의존성이 없습니다</h2><p>의존성을 추가하면 실행 경로를 여기에서 확인할 수 있습니다.</p></div>
  if (effectiveState === 'error') return <div className="state-card state-card--error dependency-graph-state" role="alert"><h2>의존성 정보를 불러오지 못했습니다</h2><p>{errorMessage}</p>{onRetry ? <button className="button button--secondary" onClick={onRetry} type="button">다시 시도</button> : null}</div>
  if (effectiveState === 'disabled') return <section aria-label="의존성 실행이 비활성화됨" className="state-card dependency-graph-state dependency-graph-state--disabled" role="status"><h2>의존성 실행이 비활성화됨</h2><p>{disabledMessage}</p></section>
  return <DependencyGraph {...graphProps} />
}
