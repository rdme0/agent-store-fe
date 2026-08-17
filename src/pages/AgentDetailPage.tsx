import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { disableAgentVersion, getAgentBySlug, publishAgentVersion } from '../entities/agent/api'
import type { AgentVersionModel } from '../entities/agent/model'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Agent 정보를 불러오지 못했습니다.'
}

export function AgentDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const agentQuery = useQuery({
    queryKey: ['agent', slug],
    queryFn: () => getAgentBySlug(slug),
    enabled: Boolean(slug),
  })
  const publishMutation = useMutation({
    mutationFn: publishAgentVersion,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', slug] })
      void queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
  const disableMutation = useMutation({
    mutationFn: disableAgentVersion,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', slug] })
      void queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })

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
  const actionError = publishMutation.error ?? disableMutation.error
  return (
    <section className="registry-page" aria-labelledby="agent-detail-title">
      <div className="page-heading page-heading--compact">
        <div>
          <Link className="back-link" to="/agents">← Marketplace</Link>
          <p className="eyebrow">Agent Detail</p>
          <h1 id="agent-detail-title">{agent.name}</h1>
          <p className="agent-card__slug">/{agent.slug} · {agent.developerName}</p>
        </div>
        <Link className="button button--primary" to={`/agents/${agent.slug}/versions/new`}>새 Version</Link>
      </div>
      <p className="detail-description">{agent.description}</p>
      {actionError ? <p className="form-error form-error--summary" role="alert">{errorMessage(actionError)}</p> : null}
      <div className="version-list" aria-label="Agent Versions">
        <div className="section-heading"><h2>Versions</h2><span>{agent.versions.length}개</span></div>
        {agent.versions.length === 0 ? (
          <div className="state-card">
            <h2>아직 Version이 없습니다.</h2>
            <p>DRAFT Version을 추가해 Agent의 실행 정보를 준비하세요.</p>
            <Link className="button button--secondary" to={`/agents/${agent.slug}/versions/new`}>Version 추가</Link>
          </div>
        ) : agent.versions.map((version) => (
          <VersionRow
            disablePending={disableMutation.isPending}
            key={version.id}
            onDisable={() => disableMutation.mutate(version.id)}
            onPublish={() => publishMutation.mutate(version.id)}
            publishPending={publishMutation.isPending}
            version={version}
          />
        ))}
      </div>
      <button className="text-link-button" onClick={() => navigate('/agents')} type="button">목록으로 돌아가기</button>
    </section>
  )
}

interface VersionRowProps {
  disablePending: boolean
  onDisable: () => void
  onPublish: () => void
  publishPending: boolean
  version: AgentVersionModel
}

function VersionRow({ disablePending, onDisable, onPublish, publishPending, version }: VersionRowProps) {
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
        <p className="version-row__meta">PayTo: {version.payTo}</p>
      </div>
      <div className="version-row__actions">
        {version.status === 'DRAFT' ? (
          <button className="button button--secondary" disabled={publishPending} onClick={onPublish} type="button">
            {publishPending ? '게시 중…' : 'Publish'}
          </button>
        ) : null}
        {version.status === 'ACTIVE' ? (
          <button className="button button--danger" disabled={disablePending} onClick={onDisable} type="button">
            {disablePending ? '비활성화 중…' : 'Disable'}
          </button>
        ) : null}
      </div>
    </article>
  )
}
