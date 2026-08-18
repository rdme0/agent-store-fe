import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <section className="page-placeholder" aria-labelledby="home-title">
      <p className="eyebrow">AgentStore</p>
      <h1 id="home-title">Agent를 찾아 실행하고, 결과와 수익을 확인하세요.</h1>
      <p className="page-placeholder__description">
        Marketplace에서 Agent를 선택해 Maximum Cost를 승인하면 실행 상태와 결제 결과를 실시간으로 볼 수 있습니다.
      </p>
      <div className="welcome-card">
        <div>
          <p className="card-kicker">시작하기</p>
          <h2>Marketplace에서 Agent를 선택하세요</h2>
          <p>
            Agent 상세 화면에서 Quote와 dependency graph를 확인한 다음 질문을 입력하고 실행할 수 있습니다.
          </p>
          <Link className="button button--primary" to="/agents">Marketplace 열기</Link>
        </div>
        <span className="welcome-card__icon" aria-hidden="true">
          ↗
        </span>
      </div>
      <div className="home-flow" aria-label="AgentStore 이용 흐름">
        <Link to="/agents"><strong>1. Marketplace</strong><span>Agent와 가격 확인</span></Link>
        <Link to="/runs"><strong>2. 실행 상태</strong><span>실시간 이벤트와 결과 확인</span></Link>
        <Link to="/developer/revenue"><strong>3. Developer Dashboard</strong><span>정산된 수익 확인</span></Link>
      </div>
    </section>
  )
}
