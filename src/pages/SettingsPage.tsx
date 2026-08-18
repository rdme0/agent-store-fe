import { Link } from 'react-router-dom'
import { API_BASE_URL, DEMO_DEVELOPER_ID } from '../shared/config/env'

export function SettingsPage() {
  return (
    <section className="registry-page registry-page--narrow" aria-labelledby="settings-title">
      <p className="eyebrow">Settings</p>
      <h1 id="settings-title">데모 연결 설정</h1>
      <p className="page-placeholder__description">브라우저에 적용된 공개 설정만 표시합니다. 비밀 값은 이 화면에 표시하거나 저장하지 않습니다.</p>
      <dl className="settings-list">
        <div><dt>API URL</dt><dd>{API_BASE_URL}</dd></div>
        <div><dt>Developer Dashboard</dt><dd>{DEMO_DEVELOPER_ID ? '연결됨' : 'VITE_DEMO_DEVELOPER_ID가 설정되지 않음'}</dd></div>
      </dl>
      {DEMO_DEVELOPER_ID ? (
        <Link className="button button--primary" to="/developer/revenue">Developer Dashboard 열기</Link>
      ) : (
        <p className="state-card" role="status">`.env.local`에 VITE_DEMO_DEVELOPER_ID를 설정한 뒤 개발 서버를 다시 시작하세요.</p>
      )}
    </section>
  )
}
