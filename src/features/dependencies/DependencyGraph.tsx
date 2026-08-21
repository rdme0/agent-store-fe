import { useId, type CSSProperties } from 'react'

export type DependencyGraphState = 'loading' | 'empty' | 'error' | 'disabled' | 'ready'

export interface DependencyNodeViewModel {
  id: string
  label: string
  description?: string
  optional?: boolean
  disabled?: boolean
}

export interface DependencyEdgeViewModel {
  id?: string
  source: string
  target: string
  label?: string
  optional?: boolean
  /** Marks this exact edge as part of the reported cycle. */
  cycle?: boolean
}

export interface DependencyCostSummary {
  maxCost?: string
  budget?: string
  currency?: string
}

export interface DependencyGraphProps {
  nodes: readonly DependencyNodeViewModel[]
  edges: readonly DependencyEdgeViewModel[]
  title?: string
  cyclePath?: readonly string[]
  /** Exact edge IDs to highlight when cycle metadata is not attached to edges. */
  cycleEdgeIds?: readonly string[]
  optionalDependencyWarning?: string
  costSummary?: DependencyCostSummary
}

export interface DependencyGraphPanelProps extends DependencyGraphProps {
  state?: DependencyGraphState
  errorMessage?: string
  disabledMessage?: string
  onRetry?: () => void
}

interface Point {
  x: number
  y: number
}

const nodeColumns = 3
const nodeWidth = 190
const nodeColumnGap = 30
const nodeRowHeight = 98
const nodeTop = 44
const nodeLeft = 34

function edgeIdentifier(edge: DependencyEdgeViewModel, index: number): string {
  return edge.id ?? `${edge.source}-${edge.target}-${index}`
}

function normalizeCyclePath(cyclePath: readonly string[] | undefined): readonly string[] {
  if (!cyclePath || cyclePath.length === 0) return []

  const normalized = [...cyclePath]
  while (normalized.length > 1 && normalized[normalized.length - 1] === normalized[0]) {
    normalized.pop()
  }
  return normalized
}

function graphPoint(index: number): Point {
  return {
    x: nodeLeft + (index % nodeColumns) * (nodeWidth + nodeColumnGap) + nodeWidth / 2,
    y: nodeTop + Math.floor(index / nodeColumns) * nodeRowHeight + 28,
  }
}

function graphDimensions(nodeCount: number): { height: number; width: number } {
  const rows = Math.max(1, Math.ceil(nodeCount / nodeColumns))
  return {
    height: nodeTop + rows * nodeRowHeight,
    width: nodeLeft * 2 + nodeColumns * nodeWidth + (nodeColumns - 1) * nodeColumnGap,
  }
}

function costValue(value: string, currency: string | undefined): string {
  return currency ? `${value} ${currency}` : value
}

function cycleLabel(
  cyclePath: readonly string[] | undefined,
  nodesById: ReadonlyMap<string, DependencyNodeViewModel>,
): string | undefined {
  if (!cyclePath || cyclePath.length === 0) return undefined
  const labels = cyclePath.map((id) => nodesById.get(id)?.label ?? id)
  return `${labels.join(' → ')}${labels.length > 1 ? ` → ${labels[0]}` : ''}`
}

function edgeIsInCycle(
  edge: DependencyEdgeViewModel,
  index: number,
  cycleEdgeIds: ReadonlySet<string>,
): boolean {
  if (edge.cycle !== undefined) return edge.cycle
  return cycleEdgeIds.has(edgeIdentifier(edge, index))
}

export function DependencyGraph({
  costSummary,
  cyclePath,
  cycleEdgeIds,
  edges,
  nodes,
  optionalDependencyWarning,
  title = '의존성',
}: DependencyGraphProps) {
  const normalizedCyclePath = normalizeCyclePath(cyclePath)
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const nodeIndexes = new Map(nodes.map((node, index) => [node.id, index]))
  const indexedEdges = edges.map((edge, index) => ({ edge, index }))
  const cycleNodeIds = new Set(normalizedCyclePath)
  const cycleEdgeIdSet = new Set(cycleEdgeIds ?? [])
  const dimensions = graphDimensions(nodes.length)
  const cycleText = cycleLabel(normalizedCyclePath, nodesById)
  const headingId = useId()
  const hasCostSummary = Boolean(costSummary?.maxCost || costSummary?.budget)

  return (
    <section className="dependency-graph" aria-labelledby={headingId}>
      <div className="dependency-graph__header">
        <div>
          <p className="card-kicker">의존성 그래프</p>
          <h2 id={headingId}>{title}</h2>
        </div>
        <span className="dependency-graph__count">
          노드 {nodes.length}개 · 연결 {edges.length}개
        </span>
      </div>

      {cycleText ? (
        <p className="dependency-graph__notice dependency-graph__notice--cycle" role="alert">
          <strong>순환 의존성이 감지되었습니다.</strong> {cycleText}
        </p>
      ) : null}
      {optionalDependencyWarning ? (
        <p className="dependency-graph__notice dependency-graph__notice--optional" role="note">
          {optionalDependencyWarning}
        </p>
      ) : null}

      {hasCostSummary ? (
        <dl className="dependency-graph__summary" aria-label="의존성 비용 요약">
          {costSummary?.maxCost ? (
            <div>
              <dt>최대 비용</dt>
              <dd>{costValue(costSummary.maxCost, costSummary.currency)}</dd>
            </div>
          ) : null}
          {costSummary?.budget ? (
            <div>
              <dt>예산</dt>
              <dd>{costValue(costSummary.budget, costSummary.currency)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div
        aria-hidden="true"
        className="dependency-graph__canvas"
        data-testid="dependency-graph-canvas"
        role="img"
      >
        <svg
          className="dependency-graph__svg"
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          width={dimensions.width}
        >
          {indexedEdges.map(({ edge, index }) => {
            const sourceIndex = nodeIndexes.get(edge.source)
            const targetIndex = nodeIndexes.get(edge.target)
            if (sourceIndex === undefined || targetIndex === undefined) return null
            const source = graphPoint(sourceIndex)
            const target = graphPoint(targetIndex)
            const isCycle = edgeIsInCycle(edge, index, cycleEdgeIdSet)
            return (
              <line
                className={isCycle ? 'dependency-graph__edge dependency-graph__edge--cycle' : 'dependency-graph__edge'}
                data-edge-id={edgeIdentifier(edge, index)}
                key={edgeIdentifier(edge, index)}
                x1={source.x}
                x2={target.x}
                y1={source.y}
                y2={target.y}
              />
            )
          })}
          {nodes.map((node, index) => {
            const point = graphPoint(index)
            return (
              <circle
                className={cycleNodeIds.has(node.id) ? 'dependency-graph__dot dependency-graph__dot--cycle' : 'dependency-graph__dot'}
                cx={point.x}
                cy={point.y}
                key={node.id}
                r="7"
              />
            )
          })}
        </svg>
        <div className="dependency-graph__visual-nodes">
          {nodes.map((node, index) => {
            const point = graphPoint(index)
            const style = {
              '--dependency-node-x': `${point.x - nodeWidth / 2}px`,
              '--dependency-node-y': `${point.y - 28}px`,
            } as CSSProperties
            return (
              <div
                className={[
                  'dependency-graph__visual-node',
                  cycleNodeIds.has(node.id) ? 'dependency-graph__visual-node--cycle' : '',
                  node.disabled ? 'dependency-graph__visual-node--disabled' : '',
                ].filter(Boolean).join(' ')}
                key={node.id}
                style={style}
              >
                {node.label}
              </div>
            )
          })}
        </div>
      </div>

      <div className="dependency-graph__fallback">
        <h3>의존성 목록</h3>
        <ul aria-label="의존성 노드" className="dependency-graph__nodes">
          {nodes.map((node) => {
            const nodeEdges = indexedEdges.filter(({ edge }) => edge.source === node.id)
            const isCycle = cycleNodeIds.has(node.id)
            return (
              <li
                className={[
                  'dependency-graph__node',
                  isCycle ? 'dependency-graph__node--cycle' : '',
                  node.disabled ? 'dependency-graph__node--disabled' : '',
                ].filter(Boolean).join(' ')}
                data-node-id={node.id}
                key={node.id}
              >
                <div className="dependency-graph__node-heading">
                  <strong>{node.label}</strong>
                  {node.optional ? <span className="dependency-graph__tag">선택</span> : null}
                  {isCycle ? <span className="dependency-graph__tag dependency-graph__tag--cycle">순환</span> : null}
                  {node.disabled ? <span className="dependency-graph__tag">비활성화</span> : null}
                </div>
                {node.description ? <p>{node.description}</p> : null}
                {nodeEdges.length > 0 ? (
                  <ul aria-label={`${node.label} 의존성`} className="dependency-graph__edges">
                    {nodeEdges.map(({ edge, index }) => {
                      const target = nodesById.get(edge.target)
                      const isCycleEdge = edgeIsInCycle(edge, index, cycleEdgeIdSet)
                      return (
                        <li
                          className={isCycleEdge ? 'dependency-graph__edge-item dependency-graph__edge-item--cycle' : 'dependency-graph__edge-item'}
                          data-edge-id={edgeIdentifier(edge, index)}
                          key={edgeIdentifier(edge, index)}
                        >
                          <span>{target?.label ?? edge.target}</span>
                          {edge.label ? <span> · {edge.label}</span> : null}
                          {edge.optional ? <span className="dependency-graph__tag">선택</span> : null}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="dependency-graph__leaf">하위 의존성이 없습니다.</p>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export function DependencyGraphPanel({
  disabledMessage = '의존성 실행이 현재 비활성화되어 있습니다.',
  errorMessage = '의존성 정보를 불러오지 못했습니다.',
  onRetry,
  state,
  ...graphProps
}: DependencyGraphPanelProps) {
  const disabledHeadingId = useId()
  const effectiveState = state ?? (graphProps.nodes.length === 0 ? 'empty' : 'ready')

  if (effectiveState === 'loading') {
    return <div className="state-card dependency-graph-state" role="status"><h2>의존성 정보를 불러오는 중…</h2><p>의존성 그래프를 준비하고 있습니다.</p></div>
  }

  if (effectiveState === 'empty') {
    return <div className="state-card dependency-graph-state" role="status"><h2>등록된 의존성이 없습니다</h2><p>의존성을 추가하면 실행 경로를 여기에서 확인할 수 있습니다.</p></div>
  }

  if (effectiveState === 'error') {
    return (
      <div className="state-card state-card--error dependency-graph-state" role="alert">
        <h2>의존성 정보를 불러오지 못했습니다</h2>
        <p>{errorMessage}</p>
        {onRetry ? <button className="button button--secondary" onClick={onRetry} type="button">다시 시도</button> : null}
      </div>
    )
  }

  if (effectiveState === 'disabled') {
    return (
      <section
        aria-labelledby={disabledHeadingId}
        className="state-card dependency-graph-state dependency-graph-state--disabled"
        role="status"
      >
        <h2 id={disabledHeadingId}>의존성 실행이 비활성화됨</h2>
        <p>{disabledMessage}</p>
      </section>
    )
  }

  if (graphProps.nodes.length === 0) {
    return <div className="state-card dependency-graph-state" role="status"><h2>등록된 의존성이 없습니다</h2><p>의존성을 추가하면 실행 경로를 여기에서 확인할 수 있습니다.</p></div>
  }

  return <DependencyGraph {...graphProps} />
}
