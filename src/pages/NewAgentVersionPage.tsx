import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createAgentVersion, getAgentByCode, type CreateVersionInput } from '../entities/agent/api'
import { listFunctionContracts } from '../entities/function-contract/api'
import { VersionForm } from '../features/agent-registry/VersionForm'

export function NewAgentVersionPage() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const agentQuery = useQuery({
    queryKey: ['agent', code, 'developer'],
    queryFn: () => getAgentByCode(code, 'developer'),
    enabled: Boolean(code),
  })
  const functionContractsQuery = useQuery({ queryKey: ['function-contracts'], queryFn: listFunctionContracts })
  const mutation = useMutation({
    mutationFn: (input: CreateVersionInput) => createAgentVersion(agentQuery.data?.id ?? '', input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agent', code] }),
        queryClient.invalidateQueries({ queryKey: ['agents'] }),
      ])
      navigate(`/agents/${code}`)
    },
  })

  if (agentQuery.isPending || functionContractsQuery.isPending) return <p className="state-card" role="status">Agent와 기능 계약을 확인하는 중…</p>
  if (agentQuery.isError || functionContractsQuery.isError) {
    const error = agentQuery.error ?? functionContractsQuery.error
    return (
      <div className="state-card state-card--error" role="alert">
        <p>{error instanceof Error ? error.message : 'Agent 또는 기능 계약을 불러오지 못했습니다.'}</p>
        <div className="error-page__actions">
          <button className="button button--secondary" onClick={() => { void agentQuery.refetch(); void functionContractsQuery.refetch() }} type="button">다시 시도</button>
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
      <Link className="back-link" to={`/agents/${code}`}>← {agentQuery.data.name}</Link>
      <p className="eyebrow">New Version</p>
      <h1 id="new-version-title">새 Version을 추가하세요.</h1>
      <p className="page-placeholder__description">새 Version은 DRAFT로 저장되며, Agent Detail에서 Publish할 수 있습니다.</p>
      <VersionForm
        functionContracts={functionContractsQuery.data}
        isSubmitting={mutation.isPending}
        onSubmit={(input) => mutation.mutate(input)}
        serverError={mutation.error instanceof Error ? mutation.error.message : undefined}
      />
    </section>
  )
}
