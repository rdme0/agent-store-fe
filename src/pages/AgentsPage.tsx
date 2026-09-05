import { useInfiniteQuery } from '@tanstack/react-query'
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMarketplaceAgents, type MarketplaceAgentSort } from '../entities/agent/api'
import { getActiveVersion, type AgentModel } from '../entities/agent/model'
import { useDisplayMode } from '../app/DisplayModeContext'

const PAGE_SIZE = 12

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Agent 목록을 불러오지 못했습니다.'
}

export function AgentsPage() {
  const { displayMode } = useDisplayMode()
  const [searchDraft, setSearchDraft] = useState('')
  const [criteria, setCriteria] = useState<{ q?: string; sort: MarketplaceAgentSort }>({ sort: 'newest' })
  const loadMoreLockedRef = useRef(false)
  const agentsQuery = useInfiniteQuery({
    queryKey: ['marketplace-agents', displayMode, criteria],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listMarketplaceAgents({ ...criteria, cursor: pageParam, limit: PAGE_SIZE, usageType: displayMode === 'easy' ? 'user_facing' : undefined }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: false,
  })
  const agents = agentsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const featuredAgent = displayMode === 'easy' ? agents[0] : undefined
  const listedAgents = featuredAgent ? agents.slice(1) : agents

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = searchDraft.trim()
    setCriteria((current) => ({ ...current, q: q || undefined }))
  }

  function changeSort(event: ChangeEvent<HTMLSelectElement>) {
    const sort = event.target.value as MarketplaceAgentSort
    setCriteria((current) => ({ ...current, sort }))
  }

  async function loadMore() {
    if (loadMoreLockedRef.current || !agentsQuery.hasNextPage) {
      return
    }
    loadMoreLockedRef.current = true
    try {
      await agentsQuery.fetchNextPage()
    } finally {
      loadMoreLockedRef.current = false
    }
  }

  return (
    <section className="marketplace-page" aria-labelledby="agents-title">
      <div className="marketplace-page__heading">
        <div>
          <p className="section-label">AI 분석 Marketplace</p>
          <h1 id="agents-title">{displayMode === 'easy' ? '필요한 분석을 골라보세요' : 'Agent Marketplace'}</h1>
          <p className="marketplace-page__description">
            {displayMode === 'easy'
              ? '여러 전문 AI가 필요한 정보를 확인하고, 하나의 답변으로 정리해 드려요.'
              : '기능과 비용을 비교하고, 필요한 Agent를 실행하거나 공급자로 등록하세요.'}
          </p>
        </div>
        {displayMode === 'developer' ? <Link className="button button--primary" to="/agents/new">새 Agent 등록</Link> : null}
      </div>

      <form className={displayMode === 'easy' ? 'marketplace-toolbar marketplace-toolbar--easy' : 'marketplace-toolbar'} onSubmit={submitSearch} role="search">
        <label className="marketplace-toolbar__search" htmlFor="agent-search">
          <span className="visually-hidden">Agent 검색</span>
          <input
            id="agent-search"
            name="q"
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={displayMode === 'easy' ? '어떤 분석이 필요한가요?' : 'Agent 이름 또는 설명으로 검색'}
            type="search"
            value={searchDraft}
          />
        </label>
        <button className="button button--secondary" type="submit">검색</button>
        {displayMode === 'developer' ? (
          <label className="marketplace-toolbar__sort" htmlFor="agent-sort">
            <span>정렬</span>
            <select id="agent-sort" onChange={changeSort} value={criteria.sort}>
              <option value="newest">최신 등록순</option>
              <option value="name_asc">이름순</option>
            </select>
          </label>
        ) : null}
      </form>

      {agentsQuery.isPending ? <div className="marketplace-grid marketplace-grid--skeleton" role="status" aria-label="Agent 목록을 불러오는 중"><AgentSkeleton featured={displayMode === 'easy'} /><AgentSkeleton /><AgentSkeleton /><AgentSkeleton /></div> : null}
      {agentsQuery.isError ? (
        <div className="marketplace-error-banner" role="alert">
          <strong>Marketplace를 불러오지 못했습니다.</strong>
          <p>{getErrorMessage(agentsQuery.error)}</p>
          <button className="button button--secondary" onClick={() => void agentsQuery.refetch()} type="button">다시 시도</button>
        </div>
      ) : null}
      {agentsQuery.isSuccess && agents.length === 0 ? (
        <div className="state-card">
          <h2>등록된 Agent가 없습니다.</h2>
          <p>{displayMode === 'easy' ? '지금 이용할 수 있는 분석 Agent가 없습니다.' : '첫 번째 Agent를 등록하고 공개할 Version을 준비해 보세요.'}</p>
          {displayMode === 'developer' ? <Link className="button button--secondary" to="/agents/new">Agent 등록하기</Link> : null}
        </div>
      ) : null}
      {agentsQuery.isSuccess && agents.length > 0 ? (
        <>
          {featuredAgent ? <AgentCard agent={featuredAgent} featured key={featuredAgent.id} mode={displayMode} /> : null}
          {displayMode === 'easy' && listedAgents.length > 0 ? (
            <section aria-labelledby="more-agents-title" className="marketplace-page__catalog">
              <div className="marketplace-page__catalog-heading">
                <div>
                  <p className="section-label">다른 분석</p>
                  <h2 id="more-agents-title">더 살펴보기</h2>
                </div>
                <p>{displayMode === 'easy' ? '지금 필요한 분석을 선택하세요.' : `${listedAgents.length}개 Agent`}</p>
              </div>
              <div className="marketplace-grid">
                {listedAgents.map((agent) => <AgentCard agent={agent} key={agent.id} mode={displayMode} />)}
              </div>
            </section>
          ) : null}
          {displayMode === 'developer' ? (
            <div className="marketplace-grid">
              {agents.map((agent) => <AgentCard agent={agent} key={agent.id} mode={displayMode} />)}
            </div>
          ) : null}
          {agentsQuery.hasNextPage ? (
            <div className="marketplace-page__more">
              <button className="button button--secondary" disabled={agentsQuery.isFetchingNextPage} onClick={() => void loadMore()} type="button">
                {agentsQuery.isFetchingNextPage ? '더 불러오는 중…' : '더 보기'}
              </button>
            </div>
          ) : null}
          {agentsQuery.isFetchingNextPage ? <p className="visually-hidden" role="status">다음 Agent 목록을 불러오는 중입니다.</p> : null}
        </>
      ) : null}
    </section>
  )
}

function AgentCard({ agent, featured = false, mode }: { agent: AgentModel; featured?: boolean; mode: 'easy' | 'developer' }) {
  const activeVersion = getActiveVersion(agent)
  const analysisSummary = agent.dependencyCount > 0
    ? `${agent.dependencyCount}가지 전문 분석을 함께 확인해요.`
    : '질문을 바탕으로 필요한 내용을 정리해요.'
  return (
    <article className={featured ? 'marketplace-agent-card marketplace-agent-card--featured' : 'marketplace-agent-card'}>
      <Link aria-label={`${agent.name} 상세 및 실행`} className="marketplace-agent-card__link" to={`/agents/${agent.code}`}>
        <div className="marketplace-agent-card__header">
          <div>
            {featured && mode === 'easy' ? <p className="marketplace-agent-card__eyebrow">바로 시작하기</p> : null}
            <h2>{agent.name}</h2>
            {mode === 'developer' ? <p className="marketplace-agent-card__developer">{agent.developerName}</p> : null}
          </div>
          {mode === 'developer' ? <span className="status-badge status-badge--active">공개됨</span> : null}
        </div>
        <p className="marketplace-agent-card__description">{agent.description}</p>
        {mode === 'easy' ? (
          <div className="marketplace-agent-card__easy-summary">
            <p>{analysisSummary}</p>
            <strong>한 번 분석할 때 {activeVersion?.priceLabel ?? '가격 미정'}부터</strong>
          </div>
        ) : (
          <dl className="marketplace-agent-card__meta">
            <div><dt>Version</dt><dd>{activeVersion ? `v${activeVersion.semver}` : '공개 Version 없음'}</dd></div>
            <div><dt>기본 호출 비용</dt><dd>{activeVersion?.priceLabel ?? '가격 미정'}</dd></div>
            <div><dt>의존성 수</dt><dd>{agent.dependencyCount}개</dd></div>
          </dl>
        )}
        <span className="marketplace-agent-card__cta">{mode === 'easy' ? '분석해 보기' : '상세 및 실행'} <span aria-hidden="true">→</span></span>
      </Link>
    </article>
  )
}

function AgentSkeleton({ featured = false }: { featured?: boolean }) {
  return <div aria-hidden="true" className={featured ? 'marketplace-agent-card marketplace-agent-card--featured marketplace-agent-card--skeleton' : 'marketplace-agent-card marketplace-agent-card--skeleton'}><span /><span /><span /><span /></div>
}
