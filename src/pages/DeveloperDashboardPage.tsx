import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getDeveloperRevenue } from '../entities/revenue/api'
import { formatAtomicUsdc } from '../entities/agent/model'
import { DEMO_DEVELOPER_ID } from '../shared/config/env'
import { baseSepoliaExplorerUrl, paymentModeLabel } from '../features/execution/paymentPresentation'

const PAGE_SIZE = 20

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '수익 정보를 불러오지 못했습니다.'
}

export function DeveloperDashboardPage() {
  const revenue = useInfiniteQuery({
    queryKey: ['developer-revenue', DEMO_DEVELOPER_ID],
    enabled: Boolean(DEMO_DEVELOPER_ID),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getDeveloperRevenue(DEMO_DEVELOPER_ID, { cursor: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (page) => page.nextCursor,
    retry: false,
  })

  if (!DEMO_DEVELOPER_ID) return <section className="registry-page"><div className="state-card state-card--error" role="alert"><h1>Developer Dashboard를 열 수 없습니다.</h1><p>VITE_DEMO_DEVELOPER_ID 설정이 필요합니다.</p></div></section>
  if (revenue.isPending) return <section className="state-card" role="status"><h1>수익 정보를 불러오는 중</h1><p>Developer 정산 내역을 확인하고 있습니다.</p></section>
  if (revenue.isError) return <section className="state-card state-card--error" role="alert"><h1>수익 정보를 불러오지 못했습니다.</h1><p>{errorMessage(revenue.error)}</p><button className="button button--secondary" onClick={() => void revenue.refetch()} type="button">다시 시도</button></section>

  const first = revenue.data.pages[0]
  const entries = revenue.data.pages.flatMap((page) => page.entries)
  return <section className="registry-page developer-dashboard" aria-labelledby="revenue-title">
    <div className="page-heading page-heading--compact"><div><Link className="back-link" to="/agents">← Marketplace</Link><p className="eyebrow">Developer Dashboard</p><h1 id="revenue-title">개발자 수익</h1><p className="agent-card__slug">{first.developerId}</p></div></div>
    <dl aria-label="수익 요약" className="developer-dashboard__summary">
      <div><dt>총 수익</dt><dd>{formatAtomicUsdc(first.totalRevenueAtomic)}</dd></div>
      <div><dt>Direct</dt><dd>{formatAtomicUsdc(first.directRevenueAtomic)} · {first.directCount}회</dd></div>
      <div><dt>Dependency</dt><dd>{formatAtomicUsdc(first.dependencyRevenueAtomic)} · {first.dependencyCount}회</dd></div>
    </dl>
    <section aria-labelledby="revenue-entries-title" className="developer-dashboard__entries"><h2 id="revenue-entries-title">정산 내역</h2>
      {entries.length === 0 ? <p className="state-card">아직 정산된 수익이 없습니다.</p> : <ul aria-label="수익 정산 목록" className="developer-dashboard__list">{entries.map((entry) => {
        const explorerUrl = baseSepoliaExplorerUrl(entry.transactionHash)
        return <li key={entry.id}><div><strong>{entry.type === 'DIRECT' ? 'Direct 호출' : 'Dependency 호출'}</strong><span>{paymentModeLabel(entry.paymentMode)}</span></div><strong>{formatAtomicUsdc(entry.amountAtomic)}</strong><time dateTime={entry.createdAt}>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.createdAt))}</time>{explorerUrl ? <a href={explorerUrl} rel="noreferrer" target="_blank">Base Sepolia에서 거래 보기</a> : null}{entry.paymentIdentifier ? <code>결제 식별자: {entry.paymentIdentifier}</code> : null}</li>
      })}</ul>}
      {revenue.hasNextPage ? <button className="button button--secondary" disabled={revenue.isFetchingNextPage} onClick={() => void revenue.fetchNextPage()} type="button">{revenue.isFetchingNextPage ? '불러오는 중…' : '더 불러오기'}</button> : null}
    </section>
  </section>
}
