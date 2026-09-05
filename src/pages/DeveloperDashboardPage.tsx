import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatAtomicUsdc } from '../entities/agent/model'
import { getDemoDeveloper, getDemoDeveloperAgents, getDemoDeveloperRevenue } from '../entities/developer/api'
import { baseSepoliaExplorerUrl, paymentNetworkLabel } from '../features/execution/paymentPresentation'
import { versionStatusLabel } from '../shared/ui/statusLabels'

const PAGE_SIZE = 20

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '개발자 정보를 불러오지 못했습니다.'
}

function formatRevenueDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function DeveloperDashboardPage() {
  const developer = useQuery({ queryKey: ['demo-developer'], queryFn: getDemoDeveloper, retry: false })
  const agents = useQuery({ queryKey: ['demo-developer-agents'], queryFn: getDemoDeveloperAgents, enabled: developer.isSuccess, retry: false })
  const revenue = useInfiniteQuery({
    queryKey: ['demo-developer-revenue'],
    enabled: developer.isSuccess,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getDemoDeveloperRevenue({ cursor: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (page) => page.nextCursor,
    retry: false,
  })

  if (developer.isPending) return <section className="state-card" role="status"><h1>개발자 대시보드를 준비하는 중</h1><p>데모 개발자 정보를 확인하고 있습니다.</p></section>
  if (developer.isError || !developer.data) return <section className="state-card state-card--error" role="alert"><h1>개발자 대시보드를 열 수 없습니다.</h1><p>{errorMessage(developer.error)}</p><button className="button button--secondary" onClick={() => void developer.refetch()} type="button">다시 시도</button></section>

  const ownedAgents = agents.data ?? []
  const revenuePages = revenue.data?.pages ?? []
  const entries = revenuePages.flatMap((page) => page.entries)
  const first = revenuePages[0]
  return (
    <section className="registry-page developer-dashboard" aria-labelledby="developer-dashboard-title">
      <header className="developer-dashboard__header">
        <div><Link className="back-link" to="/marketplace">← Marketplace</Link><p className="eyebrow">개발자 대시보드</p><h1 id="developer-dashboard-title">내 Agent 관리</h1><p className="developer-dashboard__description">초안은 공개하면 Marketplace와 quote 후보에 바로 반영됩니다. 실행 시에는 Function Contract의 입·출력 검사가 적용됩니다.</p></div>
      </header>

      <section aria-labelledby="owned-agents-title" className="developer-dashboard__entries">
        <div className="developer-dashboard__entries-heading"><div><h2 id="owned-agents-title">내 Agent</h2><p>상태: 작성 중, 공개됨, 비활성화됨</p></div><span>{agents.isError ? '확인 필요' : `${ownedAgents.length}개`}</span></div>
        {agents.isPending ? <p className="state-card" role="status">등록된 Agent를 확인하는 중이에요.</p> : agents.isError ? <div className="state-card state-card--error" role="alert"><h3>Agent 목록을 불러오지 못했습니다.</h3><p>{errorMessage(agents.error)}</p><button className="button button--secondary" onClick={() => void agents.refetch()} type="button">Agent 목록 다시 시도</button></div> : ownedAgents.length === 0 ? <div className="state-card developer-dashboard__empty"><h3>등록된 Agent가 없습니다.</h3><p>새 Agent를 등록하고 초안을 공개하면 Marketplace에 표시됩니다.</p><Link className="button button--secondary" to="/agents/new">Agent 등록하기</Link></div> : ownedAgents.map((agent) => (
          <article className="version-row" key={agent.id}><div className="version-row__main"><Link to={`/agents/${agent.code}`}><strong>{agent.name}</strong></Link><p className="version-row__meta">/{agent.code}</p>{agent.versions.map((version) => <p className="version-row__meta" key={version.id}>v{version.semver} · {versionStatusLabel(version.status)} · {version.priceLabel}</p>)}<Link className="button button--secondary" to={`/agents/${agent.code}`}>Agent 관리</Link></div></article>
        ))}
      </section>

      {revenue.isPending ? <p className="state-card" role="status">수익 요약을 불러오는 중이에요.</p> : revenue.isError || !first ? <div className="state-card state-card--error" role="alert"><h2>수익 정보를 불러오지 못했습니다.</h2><p>{errorMessage(revenue.error)}</p><button className="button button--secondary" onClick={() => void revenue.refetch()} type="button">수익 정보 다시 시도</button></div> : <dl aria-label="수익 요약" className="developer-dashboard__summary"><div><dt>총 수익</dt><dd>{formatAtomicUsdc(first.totalRevenueAtomic)}</dd></div><div><dt>직접 호출</dt><dd>{formatAtomicUsdc(first.directRevenueAtomic)}</dd><small>{first.directCount}건</small></div><div><dt>의존성 호출</dt><dd>{formatAtomicUsdc(first.dependencyRevenueAtomic)}</dd><small>{first.dependencyCount}건</small></div></dl>}

      <section aria-labelledby="revenue-entries-title" className="developer-dashboard__entries">
        <div className="developer-dashboard__entries-heading"><div><h2 id="revenue-entries-title">정산 내역</h2><p>정산이 완료된 결제만 표시합니다.</p></div><span>{entries.length}건 표시</span></div>
        {revenue.isError ? <div className="state-card state-card--error" role="alert"><h3>정산 내역을 불러오지 못했습니다.</h3><p>{errorMessage(revenue.error)}</p><button className="button button--secondary" onClick={() => void revenue.refetch()} type="button">정산 내역 다시 시도</button></div> : entries.length === 0 ? <div className="state-card developer-dashboard__empty"><h3>아직 정산된 수익이 없습니다.</h3><p>Agent가 호출되고 결제가 완료되면 이곳에서 확인할 수 있습니다.</p></div> : <div className="developer-dashboard__table-wrap"><table className="developer-dashboard__table"><thead><tr><th scope="col">구분</th><th scope="col">수익</th><th scope="col">결제 방식</th><th scope="col">발생 시각</th><th scope="col">거래</th></tr></thead><tbody>{entries.map((entry) => { const explorerUrl = baseSepoliaExplorerUrl(entry.transactionHash ?? undefined); return <tr key={entry.id}><td data-label="구분"><strong>{entry.type === 'DIRECT' ? '직접 호출' : '의존성 호출'}</strong></td><td data-label="수익" className="developer-dashboard__amount">{formatAtomicUsdc(entry.amountAtomic)}</td><td data-label="결제 방식">{paymentNetworkLabel()}</td><td data-label="발생 시각"><time dateTime={entry.createdAt}>{formatRevenueDate(entry.createdAt)}</time></td><td data-label="거래">{explorerUrl ? <a href={explorerUrl} rel="noreferrer" target="_blank">Base Sepolia 보기</a> : <span className="developer-dashboard__muted">거래 없음</span>}</td></tr> })}</tbody></table></div>}
        {!revenue.isError && revenue.hasNextPage ? <button className="button button--secondary" disabled={revenue.isFetchingNextPage} onClick={() => void revenue.fetchNextPage()} type="button">{revenue.isFetchingNextPage ? '불러오는 중…' : '더 불러오기'}</button> : null}
      </section>
    </section>
  )
}
