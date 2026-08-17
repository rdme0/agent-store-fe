import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listAgents } from '../entities/agent/api'
import { getActiveVersion, type AgentModel } from '../entities/agent/model'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Agent 목록을 불러오지 못했습니다.'
}

export function AgentsPage() {
  const agentsQuery = useQuery({ queryKey: ['agents'], queryFn: () => listAgents() })

  return (
    <section className="registry-page" aria-labelledby="agents-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Marketplace</p>
          <h1 id="agents-title">사용할 Agent를 찾아보세요.</h1>
          <p className="page-placeholder__description">
            ACTIVE Version이 있는 Agent를 탐색하고, 세부 정보와 가격을 확인하세요.
          </p>
        </div>
        <Link className="button button--primary" to="/agents/new">Agent 등록</Link>
      </div>

      {agentsQuery.isPending ? <p className="state-card" role="status">Agent 목록을 불러오는 중…</p> : null}
      {agentsQuery.isError ? (
        <div className="state-card state-card--error" role="alert">
          <p>{getErrorMessage(agentsQuery.error)}</p>
          <button className="button button--secondary" onClick={() => void agentsQuery.refetch()} type="button">다시 시도</button>
        </div>
      ) : null}
      {agentsQuery.isSuccess && agentsQuery.data.length === 0 ? (
        <div className="state-card">
          <h2>아직 공개된 Agent가 없습니다.</h2>
          <p>첫 번째 Agent를 등록하고 DRAFT Version을 만들어보세요.</p>
          <Link className="button button--secondary" to="/agents/new">Agent 등록하기</Link>
        </div>
      ) : null}
      {agentsQuery.isSuccess && agentsQuery.data.length > 0 ? (
        <div className="agent-grid">
          {agentsQuery.data.map((agent) => <AgentCard agent={agent} key={agent.id} />)}
        </div>
      ) : null}
    </section>
  )
}

function AgentCard({ agent }: { agent: AgentModel }) {
  const activeVersion = getActiveVersion(agent)
  return (
    <article className="agent-card">
      <div className="agent-card__topline">
        <span className="status-badge status-badge--active">ACTIVE</span>
        <span className="agent-card__version">{activeVersion?.semver ?? 'Version 없음'}</span>
      </div>
      <h2><Link to={`/agents/${agent.slug}`}>{agent.name}</Link></h2>
      <p className="agent-card__slug">/{agent.slug}</p>
      <p className="agent-card__description">{agent.description}</p>
      <div className="agent-card__meta">
        <span>{activeVersion?.priceLabel ?? '가격 미정'}</span>
        <span>{agent.developerName}</span>
      </div>
      <Link className="text-link" to={`/agents/${agent.slug}`}>상세 보기 →</Link>
    </article>
  )
}
