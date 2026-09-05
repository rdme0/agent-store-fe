import { ApiRequestError } from '../api/client'

export function ApiErrorDetails({ error, showErrorCode = false }: { error: unknown; showErrorCode?: boolean }) {
  if (!(error instanceof ApiRequestError)) return null
  if (!error.traceId && !(showErrorCode && error.errorCode)) return null
  return <details className="api-error-details"><summary>오류 상세</summary><dl>{showErrorCode && error.errorCode ? <div><dt>오류 코드</dt><dd><code>{error.errorCode}</code></dd></div> : null}{error.traceId ? <div><dt>추적 ID</dt><dd><code>{error.traceId}</code></dd></div> : null}</dl></details>
}
