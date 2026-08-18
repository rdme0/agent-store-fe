import { Link } from 'react-router-dom'

export function RunsPage() {
  return (
    <section className="page-placeholder" aria-labelledby="runs-title">
      <p className="eyebrow">Execution</p>
      <h1 id="runs-title">실행은 Agent 상세 화면에서 시작합니다.</h1>
      <p className="page-placeholder__description">
        현재 API는 실행 목록을 제공하지 않습니다. Marketplace에서 실행을 시작하면 생성된 실행 상세 화면에서 실시간 상태, 비용, 결과를 확인할 수 있습니다.
      </p>
      <Link className="button button--primary" to="/agents">Marketplace 열기</Link>
    </section>
  )
}
