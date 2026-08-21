import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { registerAgent, type RegisterAgentInput } from '../entities/agent/api'
import { AgentForm } from '../features/agent-registry/AgentForm'

export function RegisterAgentPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: RegisterAgentInput) => registerAgent(input),
    onSuccess: async (agent) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agents'] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace-agents'] }),
      ])
      navigate(`/agents/${agent.slug}`)
    },
  })

  return (
    <section className="registry-page registry-page--narrow" aria-labelledby="register-agent-title">
      <Link className="back-link" to="/">← Marketplace</Link>
      <p className="eyebrow">Agent 등록</p>
      <h1 id="register-agent-title">새 Agent 등록</h1>
      <p className="page-placeholder__description">등록 직후에는 DRAFT Version으로 저장됩니다. 준비가 끝나면 Agent 상세에서 Publish할 수 있습니다.</p>
      <AgentForm
        isSubmitting={mutation.isPending}
        onSubmit={async (input) => {
          await mutation.mutateAsync(input)
        }}
        serverError={mutation.error instanceof Error ? mutation.error.message : undefined}
      />
    </section>
  )
}
