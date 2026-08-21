import { Link } from 'react-router-dom'
import { DEMO_DEVELOPER_ID } from '../shared/config/env'

export function SettingsPage() {
  return (
    <section className="registry-page registry-page--narrow" aria-labelledby="settings-title">
      <p className="section-label">연결 정보</p>
      <h1 id="settings-title">개발 환경 연결</h1>
      <p className="page-placeholder__description">현재 브라우저가 사용할 수 있는 공개 연결 정보만 표시합니다. 비밀 값은 이 화면에 표시하거나 저장하지 않습니다.</p>
      <dl className="settings-list">
        <div><dt>API 연결</dt><dd>상단 상태 표시에서 확인</dd></div>
        <div><dt>개발자 Dashboard</dt><dd>{DEMO_DEVELOPER_ID ? '사용 가능' : '데모 개발자 설정이 필요함'}</dd></div>
      </dl>
      {DEMO_DEVELOPER_ID ? (
        <Link className="button button--primary" to="/developer/revenue">Developer Dashboard 열기</Link>
      ) : (
        <p className="state-card" role="status">개발자 수익 화면은 데모 개발자 설정이 완료된 뒤 사용할 수 있습니다.</p>
      )}
    </section>
  )
}
