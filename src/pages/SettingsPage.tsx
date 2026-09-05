import { Link } from 'react-router-dom'

export function SettingsPage() {
  return (
    <section className="registry-page registry-page--narrow" aria-labelledby="settings-title">
      <p className="section-label">연결 정보</p>
      <h1 id="settings-title">개발 환경 연결</h1>
      <p className="page-placeholder__description">현재 브라우저가 사용할 수 있는 공개 연결 정보만 표시합니다. 비밀 값은 이 화면에 표시하거나 저장하지 않습니다.</p>
      <dl className="settings-list">
        <div><dt>API 연결</dt><dd>상단 상태 표시에서 확인</dd></div>
        <div><dt>개발자 Dashboard</dt><dd>데모 시작 뒤 365일 access로 연결</dd></div>
      </dl>
      <Link className="button button--primary" to="/developer/revenue">Developer Dashboard 열기</Link>
    </section>
  )
}
