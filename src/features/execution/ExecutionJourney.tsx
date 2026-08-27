import { AlertTriangle, Check, Circle, Clock, LoaderCircle, Minus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { QuoteSnapshot } from '../../entities/dependency/model'
import type { ExecutionDto } from '../../entities/execution/api'
import {
  buildExecutionJourney,
  journeyStatusLabel,
  type ExecutionJourneyNode,
  type ExecutionJourneyStatus,
} from './journeyModel'

interface ExecutionJourneyProps {
  execution: ExecutionDto
  displayMode: 'easy' | 'developer'
  quoteSnapshot?: QuoteSnapshot
}

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() => (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  ))

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!media) return

    function onChange(event: MediaQueryListEvent) {
      setReducedMotion(event.matches)
    }

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return reducedMotion
}

function StatusIcon({ loading, status }: { loading: boolean; status: ExecutionJourneyStatus }) {
  if (loading) return <LoaderCircle aria-hidden="true" className="execution-journey__spinner" />
  if (status === 'completed') return <Check aria-hidden="true" />
  if (status === 'failed' || status === 'reconciliation') return <AlertTriangle aria-hidden="true" />
  if (status === 'preparing') return <Clock aria-hidden="true" />
  if (status === 'not-used') return <Minus aria-hidden="true" />
  return <Circle aria-hidden="true" />
}

function JourneyCard({
  activePathIds,
  node,
  mode,
}: {
  activePathIds: ReadonlySet<string>
  node: ExecutionJourneyNode
  mode: 'easy' | 'developer'
}) {
  const repeated = node.callCount > 1
  const inProgress = node.status === 'active' || node.status === 'preparing'
  const loading = inProgress && (node.status === 'active' || activePathIds.has(node.id))
  const statusLabel = node.status === 'not-used' && node.depth === 0
    ? '실행되지 않았어요'
    : journeyStatusLabel(node.status)
  return (
    <li className={`execution-journey__item execution-journey__item--${node.status}${loading ? ' execution-journey__item--loading' : ''}`}>
      <article className="execution-journey__card" aria-label={`${node.agentName}: ${statusLabel}`}>
        <div className="execution-journey__status-icon"><StatusIcon loading={loading} status={node.status} /></div>
        <div className="execution-journey__content">
          <div className="execution-journey__heading">
            <h3>{node.agentName}</h3>
            <span className={`execution-journey__status execution-journey__status--${node.status}`}>
              {statusLabel}
            </span>
          </div>
          <p>{node.agentDescription}</p>
          {repeated ? (
            <p className="execution-journey__calls">
              {node.callCount}번 확인 · {node.completedCallCount}번 완료
            </p>
          ) : null}
          {node.hasConfirmedCost ? (
            <p className="execution-journey__cost">이 단계에서 {node.costLabel} 사용</p>
          ) : null}
          {mode === 'developer' ? (
            <dl className="execution-journey__developer-meta">
              <div><dt>Version</dt><dd>{node.semver ? `v${node.semver}` : '확인 불가'}</dd></div>
              <div><dt>호출</dt><dd>{node.callCount}회</dd></div>
              <div><dt>결제 상태</dt><dd>{node.paymentStatuses.join(', ') || '아직 없음'}</dd></div>
            </dl>
          ) : null}
        </div>
      </article>
      {node.children.length > 0 ? (
        <ol className="execution-journey__children">
          {node.children.map((child) => (
            <JourneyCard
              key={child.id}
              activePathIds={activePathIds}
              mode={mode}
              node={child}
            />
          ))}
        </ol>
      ) : null}
    </li>
  )
}

export function ExecutionJourney({ displayMode, execution, quoteSnapshot }: ExecutionJourneyProps) {
  const model = useMemo(
    () => buildExecutionJourney(quoteSnapshot, execution),
    [execution, quoteSnapshot],
  )
  const reducedMotion = useReducedMotion()
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden')
  const liveRegionRef = useRef<HTMLParagraphElement>(null)
  const previousStatusesRef = useRef(new Map<string, ExecutionJourneyStatus>())
  const previousExecutionIdRef = useRef(execution.id)

  useEffect(() => {
    function onVisibilityChange() {
      setVisible(document.visibilityState !== 'hidden')
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    if (previousExecutionIdRef.current !== execution.id) {
      previousExecutionIdRef.current = execution.id
      previousStatusesRef.current = new Map<string, ExecutionJourneyStatus>()
      if (liveRegionRef.current) liveRegionRef.current.textContent = ''
    }

    const previous = previousStatusesRef.current
    const changed = model.statusEntries
      .filter((entry) => previous.get(entry.id) !== entry.status && entry.status !== 'planned')
      .sort((left, right) => {
        const priority: Record<ExecutionJourneyStatus, number> = {
          reconciliation: 6,
          failed: 5,
          completed: 4,
          active: 3,
          preparing: 2,
          'not-used': 1,
          planned: 0,
        }
        return priority[right.status] - priority[left.status] || right.depth - left.depth
      })
    previousStatusesRef.current = new Map(model.statusEntries.map((entry) => [entry.id, entry.status]))

    const transition = changed[0]
    if (!transition || !liveRegionRef.current) return
    if (transition.status === 'planned') return

    const messages: Record<Exclude<ExecutionJourneyStatus, 'planned'>, string> = {
      preparing: `${transition.agentName} 단계를 준비하고 있어요.`,
      active: `${transition.agentName} 단계를 시작했어요.`,
      completed: `${transition.agentName} 확인을 마쳤어요.`,
      failed: `${transition.agentName} 단계에 문제가 생겼어요.`,
      reconciliation: `${transition.agentName} 단계의 결제를 확인하고 있어요.`,
      'not-used': `${transition.agentName} 단계는 이번 답변에 사용되지 않았어요.`,
    }
    liveRegionRef.current.textContent = messages[transition.status]
  }, [execution.id, model.statusEntries])

  const paused = model.terminal || !visible || reducedMotion
  const activePathIds = new Set(model.activePathIds)
  return (
    <section
      className={`execution-journey${paused ? ' execution-journey--paused' : ''}`}
      aria-labelledby="execution-journey-title"
    >
      <div className="execution-journey__intro">
        <div>
          <p className="section-label">분석 여정</p>
          <h2 id="execution-journey-title">질문이 답변이 되기까지</h2>
        </div>
        <strong>{model.totalCount}개 분석 중 {model.completedCount}개 완료</strong>
      </div>
      {!model.terminal ? <p className="execution-journey__current">{model.activeMessage}</p> : null}
      {model.roots.length > 0 ? (
        <ol className="execution-journey__tree">
          {model.roots.map((root) => (
            <JourneyCard
              key={root.id}
              activePathIds={activePathIds}
              mode={displayMode}
              node={root}
            />
          ))}
        </ol>
      ) : <p className="state-card">표시할 분석 단계가 없습니다.</p>}
      <p ref={liveRegionRef} className="visually-hidden" aria-live="polite" aria-atomic="true" />
    </section>
  )
}
