import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../shared/config/env'
import { ConnectionStatus } from '../features/system/ConnectionStatus'

export function SettingsPage() {
  return (
    <section className="registry-page registry-page--narrow" aria-labelledby="settings-title">
      <p className="section-label">연결 정보</p>
      <h1 id="settings-title">개발 환경 연결</h1>
      <p className="page-placeholder__description">현재 브라우저가 사용할 수 있는 공개 연결 정보만 표시합니다. 비밀 값은 이 화면에 표시하거나 저장하지 않습니다.</p>
      <dl className="settings-list">
        <div><dt>API 연결</dt><dd><ConnectionStatus /> <code>{API_BASE_URL}</code></dd></div>
      </dl>
      <Link className="button button--primary" to="/developer/revenue">Developer Dashboard 열기</Link>
    </section>
  )
}
