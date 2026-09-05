import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { Link } from 'react-router-dom'
import { verifyAgentVersion } from '../entities/agent/api'
import { formatAtomicUsdc, type AgentVersionModel } from '../entities/agent/model'
import { getDemoDeveloper, getDemoDeveloperAgents, getDemoDeveloperRevenue } from '../entities/developer/api'
import { baseSepoliaExplorerUrl, paymentNetworkLabel } from '../features/execution/paymentPresentation'

const PAGE_SIZE = 20

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '개발자 정보를 불러오지 못했습니다.'
}

function formatRevenueDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

interface VerificationAction {
  agentName: string
  version: AgentVersionModel
}

export function DeveloperDashboardPage() {
  const queryClient = useQueryClient()
  const actionLocked = useRef(false)
  const [confirmation, setConfirmation] = useState<VerificationAction>()
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
  const verify = useMutation({ mutationFn: verifyAgentVersion })

  async function confirmVerification() {
    const action = confirmation
    if (!action || actionLocked.current) {
      return
    }
    actionLocked.current = true
    try {
      await verify.mutateAsync(action.version.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['demo-developer-agents'] }),
        queryClient.invalidateQueries({ queryKey: ['demo-developer-revenue'] }),
        queryClient.invalidateQueries({ queryKey: ['agents'] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace-agents'] }),
      ])
      setConfirmation(undefined)
    } catch {
      // The mutation state renders the provider error inside the confirmation.
    } finally {
      actionLocked.current = false
    }
  }

  if (developer.isPending || agents.isPending || revenue.isPending) {
    return <section className="state-card" role="status"><h1>개발자 대시보드를 준비하는 중</h1><p>등록 Agent와 정산 내역을 확인하고 있습니다.</p></section>
  }
  if (developer.isError || agents.isError || revenue.isError) {
    const error = developer.error ?? agents.error ?? revenue.error
    return <section className="state-card state-card--error" role="alert"><h1>개발자 대시보드를 열 수 없습니다.</h1><p>{errorMessage(error)}</p><button className="button button--secondary" onClick={() => void developer.refetch()} type="button">다시 시도</button></section>
  }

  const entries = revenue.data.pages.flatMap((page) => page.entries)
  const first = revenue.data.pages[0]
  return (
    <section className="registry-page developer-dashboard" aria-labelledby="developer-dashboard-title">
      <header className="developer-dashboard__header">
        <div><Link className="back-link" to="/marketplace">← Marketplace</Link><p className="eyebrow">개발자 대시보드</p><h1 id="developer-dashboard-title">내 Agent와 실제 검증</h1><p className="developer-dashboard__description">{developer.data.displayName}의 Agent readiness와 Base Sepolia testnet 결제를 관리합니다.</p></div>
      </header>

      <section aria-labelledby="owned-agents-title" className="developer-dashboard__entries">
        <div className="developer-dashboard__entries-heading"><div><h2 id="owned-agents-title">내 Agent</h2><p>ACTIVE Version은 readiness가 VERIFIED여야 Marketplace에 노출됩니다.</p></div><span>{agents.data.length}개</span></div>
        {agents.data.length === 0 ? <div className="state-card developer-dashboard__empty"><h3>등록된 Agent가 없습니다.</h3><p>새 Agent를 등록하면 여기에서 readiness와 verification 상태를 확인할 수 있습니다.</p></div> : agents.data.map((agent) => (
          <article className="version-row" key={agent.id}>
            <div className="version-row__main"><strong>{agent.name}</strong><p className="version-row__meta">/{agent.code}</p>{agent.versions.map((version) => <VersionReadiness key={version.id} version={version} />)}</div>
            <div className="version-row__actions">{agent.versions.filter(canVerify).map((version) => <button className="button button--primary" disabled={verify.isPending} key={version.id} onClick={() => setConfirmation({ agentName: agent.name, version })} type="button">검증</button>)}</div>
          </article>
        ))}
      </section>

      <dl aria-label="수익 요약" className="developer-dashboard__summary">
        <div><dt>총 수익</dt><dd>{formatAtomicUsdc(first.totalRevenueAtomic)}</dd></div>
        <div><dt>직접 호출</dt><dd>{formatAtomicUsdc(first.directRevenueAtomic)}</dd><small>{first.directCount}건</small></div>
        <div><dt>의존성 호출</dt><dd>{formatAtomicUsdc(first.dependencyRevenueAtomic)}</dd><small>{first.dependencyCount}건</small></div>
      </dl>

      <section aria-labelledby="revenue-entries-title" className="developer-dashboard__entries">
        <div className="developer-dashboard__entries-heading"><div><h2 id="revenue-entries-title">정산 내역</h2><p>정산이 완료된 결제만 표시합니다.</p></div><span>{entries.length}건 표시</span></div>
        {entries.length === 0 ? <div className="state-card developer-dashboard__empty"><h3>아직 정산된 수익이 없습니다.</h3><p>Agent가 호출되고 결제가 완료되면 이곳에서 확인할 수 있습니다.</p></div> : <div className="developer-dashboard__table-wrap"><table className="developer-dashboard__table"><thead><tr><th scope="col">구분</th><th scope="col">수익</th><th scope="col">결제 방식</th><th scope="col">발생 시각</th><th scope="col">거래</th></tr></thead><tbody>{entries.map((entry) => {
          const explorerUrl = baseSepoliaExplorerUrl(entry.transactionHash ?? undefined)
          return <tr key={entry.id}><td data-label="구분"><strong>{entry.type === 'DIRECT' ? '직접 호출' : '의존성 호출'}</strong></td><td data-label="수익" className="developer-dashboard__amount">{formatAtomicUsdc(entry.amountAtomic)}</td><td data-label="결제 방식">{paymentNetworkLabel()}</td><td data-label="발생 시각"><time dateTime={entry.createdAt}>{formatRevenueDate(entry.createdAt)}</time></td><td data-label="거래">{explorerUrl ? <a href={explorerUrl} rel="noreferrer" target="_blank">Base Sepolia 보기</a> : <span className="developer-dashboard__muted">거래 없음</span>}</td></tr>
        })}</tbody></table></div>}
        {revenue.hasNextPage ? <button className="button button--secondary" disabled={revenue.isFetchingNextPage} onClick={() => void revenue.fetchNextPage()} type="button">{revenue.isFetchingNextPage ? '불러오는 중…' : '더 불러오기'}</button> : null}
      </section>
      {confirmation ? <VerificationDialog action={confirmation} error={verify.isError ? errorMessage(verify.error) : undefined} onCancel={() => !verify.isPending && setConfirmation(undefined)} onConfirm={() => void confirmVerification()} pending={verify.isPending} /> : null}
    </section>
  )
}

function canVerify(version: AgentVersionModel): boolean {
  return version.status === 'ACTIVE' && (version.readiness?.status === 'UNVERIFIED' || version.readiness?.status === 'UNAVAILABLE')
}

function VersionReadiness({ version }: { version: AgentVersionModel }) {
  const readiness = version.readiness
  return <div><p className="version-row__meta">v{version.semver} · {version.status} · readiness: {readiness?.status ?? 'UNVERIFIED'}</p><p className="version-row__meta">마지막 인증: {readiness?.lastPaidCertificationAt ?? '없음'} · 실패: {readiness?.failureCode ?? '없음'}</p></div>
}

function VerificationDialog({ action, error, onCancel, onConfirm, pending }: { action: VerificationAction; error?: string; onCancel: () => void; onConfirm: () => void; pending: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    dialog.showModal()
    return () => dialog.close()
  }, [])
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    if (pending) {
      event.preventDefault()
      return
    }
    onCancel()
  }
  return <dialog aria-labelledby="verify-title" className="confirmation-dialog" onCancel={handleCancel} ref={dialogRef}><h2 id="verify-title">실제 testnet 결제를 진행할까요?</h2><p>{action.agentName} v{action.version.semver}</p><p>Base Sepolia USDC atomic amount: <code>{action.version.priceAtomic}</code></p><p>payTo: <code>{action.version.payTo}</code></p><p>이 요청은 실제 Base Sepolia testnet x402 결제를 수행합니다. wallet 또는 facilitator 설정·잔액이 없으면 VERIFIED로 우회되지 않고 실패 원인이 표시됩니다.</p>{error ? <p role="alert">{error}</p> : null}<div className="confirmation-dialog__actions"><button autoFocus className="button button--secondary" disabled={pending} onClick={onCancel} type="button">취소</button><button className="button button--primary" disabled={pending} onClick={onConfirm} type="button">{pending ? '검증 중…' : '실제 결제 후 검증'}</button></div></dialog>
}
