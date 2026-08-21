import { useQuery } from '@tanstack/react-query'
import { getApiHealth } from '../../entities/system/api'

export function ConnectionStatus() {
  const health = useQuery({
    queryKey: ['api-health'],
    queryFn: getApiHealth,
    retry: 1,
    retryDelay: 100,
    staleTime: 30_000,
  })
  const label = health.isPending ? '연결 확인 중' : health.isError ? '연결 안 됨' : '연결됨'
  const tone = health.isPending ? 'checking' : health.isError ? 'offline' : 'online'

  return (
    <span className={`connection-status connection-status--${tone}`} role="status">
      <span aria-hidden="true" className="connection-status__dot" />
      {label}
    </span>
  )
}
