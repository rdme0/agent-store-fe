import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { disableAgentVersion, getAgentByCode, publishAgentVersion } from '../entities/agent/api'
import { formatApproximateKrw, getActiveVersion, type AgentVersionModel } from '../entities/agent/model'
import { DependencyEditor } from '../features/dependencies/DependencyEditor'
import { QuotePanel } from '../features/dependencies/QuotePanel'
import { useDisplayMode } from '../app/DisplayModeContext'
import { versionStatusLabel } from '../shared/ui/statusLabels'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Agent 정보를 불러오지 못했습니다.'
}

export function AgentDetailPage() {
  const { displayMode } = useDisplayMode()
  const { code = '' } = useParams<{ code: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const origin = (location.state as { marketplace?: string } | null)?.marketplace
  const backTo = origin?.startsWith('/marketplace') ? origin : '/marketplace'
  const mountedRef = useRef(true)
  const codeRef = useRef(code)
  const actionLockedRef = useRef(false)
  const actionTriggerRef = useRef<HTMLButtonElement>(null)
  const [confirmation, setConfirmation] = useState<VersionAction | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  useEffect(() => {
    codeRef.current = code
  }, [code])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  const agentQuery = useQuery({
    queryKey: ['agent', code],
    queryFn: () => getAgentByCode(code),
    enabled: Boolean(code),
  })
  const actionMutation = useMutation({
    mutationFn: ({ kind, versionId }: VersionAction) => {
      if (kind === 'publish') {
        return publishAgentVersion(versionId)
      }
      return disableAgentVersion(versionId)
    },
  })

  async function confirmVersionAction() {
    const currentAction = confirmation
    if (!currentAction || actionLockedRef.current) {
      return
    }
    const ownerCode = code
    actionLockedRef.current = true
    setActionNotice(null)
    try {
      await actionMutation.mutateAsync(currentAction)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agent', ownerCode] }),
        queryClient.invalidateQueries({ queryKey: ['agents'] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace-agents'] }),
        queryClient.invalidateQueries({ queryKey: ['demo-developer-agents'] }),
        queryClient.invalidateQueries({ queryKey: ['demo-developer-revenue'] }),
      ])
      if (mountedRef.current && codeRef.current === ownerCode) {
        setConfirmation(null)
        window.requestAnimationFrame(() => actionTriggerRef.current?.focus())
        setActionNotice(currentAction.kind === 'publish' ? 'Version을 Marketplace에 공개했습니다.' : 'Version을 비활성화했습니다.')
      }
    } finally {
      actionLockedRef.current = false
    }
  }

  function requestVersionAction(action: VersionAction, trigger: HTMLButtonElement) {
    if (actionLockedRef.current) {
      return
    }
    actionMutation.reset()
    actionTriggerRef.current = trigger
    setActionNotice(null)
    setConfirmation(action)
  }

  if (agentQuery.isPending) return <p className="state-card" role="status">Agent 정보를 불러오는 중…</p>
  if (agentQuery.isError) {
    return (
      <div className="state-card state-card--error" role="alert">
        <p>{errorMessage(agentQuery.error)}</p>
        <button className="button button--secondary" onClick={() => void agentQuery.refetch()} type="button">다시 시도</button>
      </div>
    )
  }

  const agent = agentQuery.data
  if (displayMode === 'easy' && agent.usageType === 'internal_component') {
    return <Navigate replace to="/marketplace" />
  }
  const activeVersion = getActiveVersion(agent)
  const readyVersion = activeVersion
  if (displayMode === 'easy') {
    return (
      <section className="agent-detail-page agent-detail-page--easy" aria-labelledby="agent-detail-title">
        <Link className="back-link" to={backTo}>← 다른 Agent 보기</Link>
        <h1 id="agent-detail-title">{agent.name}</h1>
        <p className="detail-description">{agent.description}</p>
        <ol aria-label="Agent 사용 순서" className="agent-detail-page__steps">
          <li><span>1</span><div><strong>질문을 입력해요</strong><p>원하는 분석을 한 문장으로 적어 주세요.</p></div></li>
          <li><span>2</span><div><strong>비용을 먼저 확인해요</strong><p>실행 전에 최대 비용과 결제 조건을 보여 드려요.</p></div></li>
          <li><span>3</span><div><strong>답변을 받아요</strong><p>여러 전문 Agent의 결과를 하나의 답변으로 정리해요.</p></div></li>
        </ol>
        {readyVersion ? <QuotePanel mode="easy" code={code} version={readyVersion} /> : <EasyAvailabilityNotice hasDraft={agent.versions.some((version) => version.status === 'DRAFT')} />}
      </section>
    )
  }
  const actionError = actionMutation.error
  return (
    <section className="agent-detail-page" aria-labelledby="agent-detail-title">
      <div className="agent-detail-page__summary">
        <Link className="back-link" to={backTo}>← Marketplace</Link>
        <h1 id="agent-detail-title">{agent.name}</h1>
        <p className="agent-detail-page__identity">{agent.developerName} · /{agent.code}</p>
        <p className="detail-description">{agent.description}</p>
        <dl aria-label="공개 Version 정보" className="agent-detail-page__facts">
          <div>
            <dt>기본 호출 비용</dt>
            <dd>
              {activeVersion ? <><strong>{activeVersion.priceLabel}</strong>{' '}<span>({formatApproximateKrw(activeVersion.priceAtomic)})</span></> : '공개 Version 없음'}
            </dd>
          </div>
          <div>
            <dt>공개 Version</dt>
            <dd>{activeVersion ? `v${activeVersion.semver} · ${activeVersion.network}` : '실행하려면 Version을 공개하세요.'}</dd>
          </div>
        </dl>
      </div>
      <div aria-atomic="true" aria-live="polite" className="visually-hidden">{actionNotice}</div>
      {actionNotice ? <p className="agent-detail-page__notice" role="status">{actionNotice}</p> : null}
      {actionError ? <p className="form-error form-error--summary" role="alert">{errorMessage(actionError)}</p> : null}
      <section className="version-list" aria-labelledby="versions-title">
        <div className="section-heading"><h2 id="versions-title">Version</h2><Link className="button button--secondary" to={`/agents/${agent.code}/versions/new`}>새 Version</Link></div>
        {agent.versions.length === 0 ? (
          <div className="state-card">
            <h2>아직 Version이 없습니다.</h2>
            <p>DRAFT Version을 추가해 Agent의 실행 정보를 준비하세요.</p>
            <Link className="button button--secondary" to={`/agents/${agent.code}/versions/new`}>Version 추가</Link>
          </div>
        ) : agent.versions.map((version) => (
          <VersionRow
            actionPending={actionMutation.isPending}
            key={version.id}
            onDisable={(trigger) => requestVersionAction({ kind: 'disable', ownerCode: code, versionId: version.id, semver: version.semver }, trigger)}
            onPublish={(trigger) => requestVersionAction({ kind: 'publish', ownerCode: code, versionId: version.id, semver: version.semver }, trigger)}
            version={version}
          />
        ))}
      </section>
      {agent.versions.filter((version) => version.status === 'DRAFT').map((version) => (
        <DependencyEditor agent={agent} key={version.id} code={code} version={version} />
      ))}
      {readyVersion ? (
        <div id="quote-panel">
          <QuotePanel
            key={`${code}:${readyVersion.id}`}
            code={code}
            version={readyVersion}
          />
        </div>
      ) : null}
      <button className="text-link-button" onClick={() => navigate('/marketplace')} type="button">목록으로 돌아가기</button>
      {confirmation?.ownerCode === code ? (
        <VersionActionDialog
          action={confirmation}
          error={actionMutation.isError ? errorMessage(actionMutation.error) : null}
          onCancel={() => {
            if (!actionMutation.isPending) {
              setConfirmation(null)
              actionTriggerRef.current?.focus()
            }
          }}
          onConfirm={() => void confirmVersionAction()}
          pending={actionMutation.isPending}
        />
      ) : null}
    </section>
  )
}

interface VersionRowProps {
  actionPending: boolean
  onDisable: (trigger: HTMLButtonElement) => void
  onPublish: (trigger: HTMLButtonElement) => void
  version: AgentVersionModel
}

interface VersionAction {
  kind: 'publish' | 'disable'
  ownerCode: string
  semver: string
  versionId: string
}

function VersionRow({ actionPending, onDisable, onPublish, version }: VersionRowProps) {
  const statusClass = version.status.toLowerCase()
  return (
    <article className="version-row">
      <div className="version-row__main">
        <div className="agent-card__topline">
          <span className={`status-badge status-badge--${statusClass}`}>{versionStatusLabel(version.status)}</span>
          <strong>v{version.semver}</strong>
        </div>
        <p className="version-row__endpoint">{version.endpoint}</p>
        <p className="version-row__meta">{version.network} · {version.asset}</p>
        <p className="version-row__meta">응답 형식: {version.responseFormat ?? 'JSON'}</p>
        <p className="version-row__meta">PayTo: {version.payTo}</p>
      </div>
      <div className="version-row__actions">
        {version.status === 'DRAFT' ? (
          <button className="button button--secondary" disabled={actionPending} onClick={(event) => onPublish(event.currentTarget)} type="button">
            {actionPending ? '처리 중…' : '공개하기'}
          </button>
        ) : null}
        {version.status === 'ACTIVE' ? (
          <>
            <button className="button button--danger" disabled={actionPending} onClick={(event) => onDisable(event.currentTarget)} type="button">
              {actionPending ? '처리 중…' : '비활성화'}
            </button>
          </>
        ) : null}
      </div>
    </article>
  )
}

interface VersionActionDialogProps {
  action: VersionAction
  error: string | null
  onCancel: () => void
  onConfirm: () => void
  pending: boolean
}

function VersionActionDialog({ action, error, onCancel, onConfirm, pending }: VersionActionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const title = action.kind === 'publish' ? 'Version을 공개할까요?' : 'Version을 비활성화할까요?'
  const description = action.kind === 'publish'
    ? `v${action.semver}이 Marketplace에 표시되고 실행할 수 있게 됩니다.`
    : `v${action.semver}은 더 이상 새 실행에 사용되지 않습니다.`

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    if (pending) {
      event.preventDefault()
    } else {
      onCancel()
    }
  }

  return (
    <dialog aria-labelledby="version-action-title" className="confirmation-dialog" onCancel={handleCancel} ref={dialogRef}>
      <h2 id="version-action-title">{title}</h2>
      <p>{description}</p>
      {error ? <p role="alert">{error}</p> : null}
      <div className="confirmation-dialog__actions">
        <button autoFocus className="button button--secondary" disabled={pending} onClick={onCancel} type="button">취소</button>
        <button className={action.kind === 'disable' ? 'button button--danger' : 'button button--primary'} disabled={pending} onClick={onConfirm} type="button">
          {pending ? '처리 중…' : action.kind === 'publish' ? '공개하기' : '비활성화'}
        </button>
      </div>
    </dialog>
  )
}

function EasyAvailabilityNotice({ hasDraft }: { hasDraft: boolean }) {
  const { setDisplayMode } = useDisplayMode()
  const title = hasDraft ? '이 분석은 아직 공개 준비 중이에요.' : '지금은 실행할 수 있는 Version이 없어요.'
  return <div className="state-card state-card--warning" role="status"><h2>{title}</h2><p>개발자 모드에서 초안을 공개하면 Marketplace에서 바로 실행할 수 있어요.</p><Link className="button button--secondary" onClick={() => setDisplayMode('developer')} to="/developer/revenue">개발자 화면에서 공개하기</Link></div>
}
