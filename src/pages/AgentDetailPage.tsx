import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { disableAgentVersion, getAgentByCode, publishAgentVersion } from '../entities/agent/api'
import { getActiveVersion, type AgentVersionModel } from '../entities/agent/model'
import { DependencyEditor } from '../features/dependencies/DependencyEditor'
import { QuotePanel } from '../features/dependencies/QuotePanel'
import { useDisplayMode } from '../app/DisplayModeContext'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Agent 정보를 불러오지 못했습니다.'
}

export function AgentDetailPage() {
  const { displayMode } = useDisplayMode()
  const { code = '' } = useParams<{ code: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
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
    return <Navigate replace to="/" />
  }
  const activeVersion = getActiveVersion(agent)
  if (displayMode === 'easy') {
    return (
      <section className="agent-detail-page agent-detail-page--easy" aria-labelledby="agent-detail-title">
        <Link className="back-link" to="/">← 다른 Agent 보기</Link>
        <h1 id="agent-detail-title">{agent.name}</h1>
        <p className="detail-description">{agent.description}</p>
        {activeVersion ? <QuotePanel mode="easy" code={code} version={activeVersion} /> : <p className="state-card">지금은 이 분석을 준비 중이에요.</p>}
      </section>
    )
  }
  const actionError = actionMutation.error
  return (
    <section className="agent-detail-page" aria-labelledby="agent-detail-title">
      <div className="agent-detail-page__summary">
        <div>
          <Link className="back-link" to="/agents">← Marketplace</Link>
          <h1 id="agent-detail-title">{agent.name}</h1>
          <p className="agent-detail-page__identity">{agent.developerName} · /{agent.code}</p>
          <p className="detail-description">{agent.description}</p>
        </div>
        <aside className="agent-detail-page__pricing" aria-label="현재 Agent 정보">
          <span>현재 호출 비용</span>
          <strong>{activeVersion?.priceLabel ?? '공개 Version 없음'}</strong>
          <small>{activeVersion ? `v${activeVersion.semver} · ${activeVersion.network}` : '실행하려면 Version을 공개하세요.'}</small>
          {activeVersion ? <a className="button button--primary" href="#quote-panel">실행 준비</a> : null}
        </aside>
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
      {activeVersion ? (
        <div id="quote-panel">
          <QuotePanel
            key={`${code}:${activeVersion.id}`}
            code={code}
            version={activeVersion}
          />
        </div>
      ) : null}
      <button className="text-link-button" onClick={() => navigate('/agents')} type="button">목록으로 돌아가기</button>
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
          <span className={`status-badge status-badge--${statusClass}`}>{version.status}</span>
          <strong>v{version.semver}</strong>
        </div>
        <p className="version-row__endpoint">{version.endpoint}</p>
        <p className="version-row__meta">{version.priceLabel} · {version.network} · {version.asset}</p>
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
          <button className="button button--danger" disabled={actionPending} onClick={(event) => onDisable(event.currentTarget)} type="button">
            {actionPending ? '처리 중…' : '비활성화'}
          </button>
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
