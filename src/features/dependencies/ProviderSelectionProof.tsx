import type { QuoteSnapshot } from '../../entities/dependency/model'

function providerSelections(root: QuoteSnapshot) {
  const selections: Array<QuoteSnapshot['dependencies'][number]> = []

  function visit(snapshot: QuoteSnapshot) {
    snapshot.dependencies.forEach((dependency) => {
      if (dependency.selection) selections.push(dependency)
      if (dependency.resolved) visit(dependency.resolved)
    })
  }

  visit(root)
  return selections
}

interface ProviderSelectionProofProps {
  snapshot: QuoteSnapshot
}

function strategyLabel(strategy?: string | null): string {
  return {
    lowest_price: '최저 가격',
    latest_version: '최신 Version',
    highest_reliability: '가장 높은 신뢰도',
    fastest: '가장 빠른 응답',
    balanced: '균형 선택',
  }[strategy ?? ''] ?? '고정 공급자'
}

function scopeLabel(scope?: string | null): string {
  return {
    pinned: '특정 Agent 고정',
    allowlist: '허용 Agent 안에서 선택',
    marketplace: 'Marketplace 전체',
  }[scope ?? ''] ?? '기존 직접 지정'
}

export function ProviderSelectionProof({ snapshot }: ProviderSelectionProofProps) {
  const selections = providerSelections(snapshot)
  if (selections.length === 0) return null

  return (
    <section aria-labelledby="provider-selection-title">
      <h2 id="provider-selection-title">공급자 선택 증명</h2>
      {selections.map((dependency) => (
        <section className="provider-selection-proof" key={dependency.dependencyId}>
          <div className="section-heading">
            <div><p className="eyebrow">공급자 선택</p><h3>{dependency.selection?.functionCode}</h3></div>
            <span>{strategyLabel(dependency.selection?.strategy)}</span>
          </div>
          <p>
            Quote 발급 시 <strong>{dependency.resolved?.version.agentName ?? dependency.resolved?.version.agentCode}</strong>{' '}
            v{dependency.resolved?.version.semver}을 선택하고 가격과 계약을 고정했습니다.
          </p>
          <dl className="quote-panel__summary">
            <div><dt>선택 이유</dt><dd>{dependency.selection?.selectedReason ?? '-'}</dd></div>
            <div><dt>선택 범위</dt><dd>{scopeLabel(dependency.selection?.providerScope)}</dd></div>
            <div><dt>선택 가격</dt><dd>{dependency.resolved ? `${dependency.resolved.version.priceAtomic} atomic USDC` : '선택 안 됨'}</dd></div>
            <div><dt>PayTo</dt><dd><code>{dependency.resolved?.version.payTo ?? '-'}</code></dd></div>
          </dl>
          <details>
            <summary>검사한 후보 {dependency.selection?.candidates.length ?? 0}개</summary>
            <ul>{dependency.selection?.candidates.map((candidate) => <li key={candidate.versionId}>{candidate.agentCode} v{candidate.semver} · {candidate.priceAtomic} atomic · {candidate.status}{candidate.observationCount !== null && candidate.observationCount !== undefined ? ` · 관측 ${candidate.observationCount}건 · 신뢰도 ${candidate.reliabilityPercent ?? '-'}% · p95 ${candidate.p95LatencyMillis ?? '-'}ms` : ''}</li>)}</ul>
          </details>
        </section>
      ))}
    </section>
  )
}
