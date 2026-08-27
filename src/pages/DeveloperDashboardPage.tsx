import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatAtomicUsdc } from '../entities/agent/model'
import { getDeveloperRevenue } from '../entities/revenue/api'
import { baseSepoliaExplorerUrl, paymentNetworkLabel } from '../features/execution/paymentPresentation'
import { DEMO_DEVELOPER_ID } from '../shared/config/env'

const PAGE_SIZE = 20

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '수익 정보를 불러오지 못했습니다.'
}

function formatRevenueDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
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

  if (!DEMO_DEVELOPER_ID) {
    return <section className="registry-page"><div className="state-card state-card--error" role="alert"><h1>개발자 대시보드를 열 수 없습니다.</h1><p>개발자 환경 설정이 필요합니다. 환경 변수를 확인한 뒤 개발 서버를 다시 시작해 주세요.</p></div></section>
  }
  if (revenue.isPending) {
    return <section className="state-card" role="status"><h1>수익 정보를 불러오는 중</h1><p>정산 내역을 확인하고 있습니다.</p></section>
  }
  if (revenue.isError) {
    return <section className="state-card state-card--error" role="alert"><h1>수익 정보를 불러오지 못했습니다.</h1><p>{errorMessage(revenue.error)}</p><button className="button button--secondary" onClick={() => void revenue.refetch()} type="button">다시 시도</button></section>
  }

  const first = revenue.data.pages[0]
  const entries = revenue.data.pages.flatMap((page) => page.entries)
  return (
    <section className="registry-page developer-dashboard" aria-labelledby="revenue-title">
      <header className="developer-dashboard__header">
        <div><Link className="back-link" to="/">← Marketplace</Link><p className="eyebrow">개발자 대시보드</p><h1 id="revenue-title">수익과 정산</h1><p className="developer-dashboard__description">Agent 호출로 발생한 수익과 결제 상태를 확인하세요.</p></div>
        <p className="developer-dashboard__developer-id"><span>Developer ID</span><code>{first.developerId}</code></p>
      </header>

      <dl aria-label="수익 요약" className="developer-dashboard__summary">
        <div><dt>총 수익</dt><dd>{formatAtomicUsdc(first.totalRevenueAtomic)}</dd></div>
        <div><dt>직접 호출</dt><dd>{formatAtomicUsdc(first.directRevenueAtomic)}</dd><small>{first.directCount}건</small></div>
        <div><dt>의존성 호출</dt><dd>{formatAtomicUsdc(first.dependencyRevenueAtomic)}</dd><small>{first.dependencyCount}건</small></div>
      </dl>

      <section aria-labelledby="revenue-entries-title" className="developer-dashboard__entries">
        <div className="developer-dashboard__entries-heading"><div><h2 id="revenue-entries-title">정산 내역</h2><p>정산이 완료된 결제만 표시합니다.</p></div><span>{entries.length}건 표시</span></div>
        {entries.length === 0 ? <div className="state-card developer-dashboard__empty"><h3>아직 정산된 수익이 없습니다.</h3><p>Agent가 호출되고 결제가 완료되면 이곳에서 확인할 수 있습니다.</p></div> : <div className="developer-dashboard__table-wrap"><table className="developer-dashboard__table"><thead><tr><th scope="col">구분</th><th scope="col">수익</th><th scope="col">결제 방식</th><th scope="col">발생 시각</th><th scope="col">거래</th></tr></thead><tbody>{entries.map((entry) => {
          const explorerUrl = baseSepoliaExplorerUrl(entry.transactionHash ?? undefined)
          return <tr key={entry.id}><td data-label="구분"><strong>{entry.type === 'DIRECT' ? '직접 호출' : '의존성 호출'}</strong><code className="developer-dashboard__payment-id">{entry.paymentIdentifier ?? '결제 식별자 없음'}</code></td><td data-label="수익" className="developer-dashboard__amount">{formatAtomicUsdc(entry.amountAtomic)}</td><td data-label="결제 방식">{paymentNetworkLabel()}</td><td data-label="발생 시각"><time dateTime={entry.createdAt}>{formatRevenueDate(entry.createdAt)}</time></td><td data-label="거래">{explorerUrl ? <a href={explorerUrl} rel="noreferrer" target="_blank">Base Sepolia 보기</a> : <span className="developer-dashboard__muted">거래 없음</span>}</td></tr>
        })}</tbody></table></div>}
        {revenue.hasNextPage ? <button className="button button--secondary" disabled={revenue.isFetchingNextPage} onClick={() => void revenue.fetchNextPage()} type="button">{revenue.isFetchingNextPage ? '불러오는 중…' : '더 불러오기'}</button> : null}
      </section>
    </section>
  )
}
