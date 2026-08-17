import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createAgentVersion, getAgentBySlug, type CreateVersionInput } from '../entities/agent/api'
import { VersionForm } from '../features/agent-registry/VersionForm'

export function NewAgentVersionPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const agentQuery = useQuery({ queryKey: ['agent', slug], queryFn: () => getAgentBySlug(slug), enabled: Boolean(slug) })
  const mutation = useMutation({
    mutationFn: (input: CreateVersionInput) => createAgentVersion(agentQuery.data?.id ?? '', input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agent', slug] }),
        queryClient.invalidateQueries({ queryKey: ['agents'] }),
      ])
      navigate(`/agents/${slug}`)
    },
  })

  if (agentQuery.isPending) return <p className="state-card" role="status">Agent 정보를 확인하는 중…</p>
  if (agentQuery.isError) {
    return (
      <div className="state-card state-card--error" role="alert">
        <p>{agentQuery.error instanceof Error ? agentQuery.error.message : 'Agent 정보를 불러오지 못했습니다.'}</p>
        <div className="error-page__actions">
          <button className="button button--secondary" onClick={() => void agentQuery.refetch()} type="button">다시 시도</button>
          <Link className="text-link" to="/agents">Marketplace로 이동</Link>
        </div>
      </div>
    )
  }
  if (!agentQuery.data) {
    return <div className="state-card state-card--error" role="alert"><p>Version을 추가할 Agent를 찾지 못했습니다.</p><Link className="button button--secondary" to="/agents">Marketplace로 이동</Link></div>
  }

  return (
    <section className="registry-page registry-page--narrow" aria-labelledby="new-version-title">
      <Link className="back-link" to={`/agents/${slug}`}>← {agentQuery.data.name}</Link>
      <p className="eyebrow">New Version</p>
      <h1 id="new-version-title">새 Version을 추가하세요.</h1>
      <p className="page-placeholder__description">새 Version은 DRAFT로 저장되며, Agent Detail에서 Publish할 수 있습니다.</p>
      <VersionForm
        isSubmitting={mutation.isPending}
        onSubmit={(input) => mutation.mutate(input)}
        serverError={mutation.error instanceof Error ? mutation.error.message : undefined}
      />
    </section>
  )
}
