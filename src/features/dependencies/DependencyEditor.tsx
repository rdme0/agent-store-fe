import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { listAgents } from '../../entities/agent/api'
import type { AgentModel, AgentVersionModel } from '../../entities/agent/model'
import {
  createDependency,
  listDependencies,
  removeDependency,
  updateDependency,
  type CreateDependencyInput,
  type UpdateDependencyInput,
} from '../../entities/dependency/api'
import type { DependencyModel } from '../../entities/dependency/model'
import { ApiRequestError } from '../../shared/api/client'
import { DependencyGraphPanel, type DependencyEdgeViewModel, type DependencyNodeViewModel } from './DependencyGraph'

interface DependencyEditorProps {
  agent: AgentModel
  slug: string
  version: AgentVersionModel
}

interface DependencyFormProps {
  agents: AgentModel[]
  idPrefix: string
  isSubmitting: boolean
  onCancel?: () => void
  onSubmit: (input: CreateDependencyInput | UpdateDependencyInput) => void
  sourceAgentId: string
  value?: DependencyModel
}

interface FormValues {
  maxCalls: string
  maxPriceAtomic: string
  required: boolean
  targetAgentId: string
  versionConstraint: string
}

function initialValues(value?: DependencyModel): FormValues {
  return {
    maxCalls: String(value?.maxCalls ?? 1),
    maxPriceAtomic: value?.maxPriceAtomic ?? '',
    required: value?.required ?? true,
    targetAgentId: value?.targetAgentId ?? '',
    versionConstraint: value?.versionConstraint ?? '^1.0.0',
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function cyclePathFromError(error: unknown): string[] | undefined {
  if (!(error instanceof ApiRequestError) || error.code !== 'DEPENDENCY_CYCLE_DETECTED') return undefined
  if (!error.details || typeof error.details !== 'object') return undefined
  const cycle = (error.details as { cycle?: unknown }).cycle
  return Array.isArray(cycle) && cycle.every((value): value is string => typeof value === 'string') ? cycle : undefined
}

function DependencyForm({ agents, idPrefix, isSubmitting, onCancel, onSubmit, sourceAgentId, value }: DependencyFormProps) {
  const [values, setValues] = useState(() => initialValues(value))
  const [validationError, setValidationError] = useState<string>()
  const isEditing = Boolean(value)
  const targetAgents = agents.filter((agent) => agent.id !== sourceAgentId)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const maxCalls = Number(values.maxCalls)
    if (!isEditing && !values.targetAgentId) {
      setValidationError('호출할 Agent를 선택하세요.')
      return
    }
    if (!/^\d+$/.test(values.maxPriceAtomic)) {
      setValidationError('최대 가격은 atomic USDC 정수 문자열이어야 합니다.')
      return
    }
    if (!/^\d+$/.test(values.maxCalls) || maxCalls < 1 || maxCalls > 5) {
      setValidationError('최대 호출 횟수는 1에서 5 사이여야 합니다.')
      return
    }
    if (!values.versionConstraint.trim()) {
      setValidationError('Version constraint를 입력하세요.')
      return
    }
    setValidationError(undefined)
    if (isEditing) {
      onSubmit({
        maxCalls,
        maxPriceAtomic: values.maxPriceAtomic,
        required: values.required,
        versionConstraint: values.versionConstraint.trim(),
      })
    } else {
      onSubmit({
        maxCalls,
        maxPriceAtomic: values.maxPriceAtomic,
        required: values.required,
        targetAgentId: values.targetAgentId,
        versionConstraint: values.versionConstraint.trim(),
      })
    }
  }

  return (
    <form className="dependency-form" onSubmit={submit}>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor={`dependency-target-${idPrefix}`}>Target Agent</label>
          {isEditing ? (
            <output className="form-output" id={`dependency-target-${idPrefix}`}>
              {value?.targetAgentSlug}
            </output>
          ) : (
            <select
              id={`dependency-target-${idPrefix}`}
              onChange={(event) => setValues((current) => ({ ...current, targetAgentId: event.target.value }))}
              value={values.targetAgentId}
            >
              <option value="">Agent 선택</option>
              {targetAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.slug}</option>)}
            </select>
          )}
        </div>
        <div className="form-field">
          <label htmlFor={`dependency-constraint-${idPrefix}`}>Version constraint</label>
          <input
            id={`dependency-constraint-${idPrefix}`}
            onChange={(event) => setValues((current) => ({ ...current, versionConstraint: event.target.value }))}
            value={values.versionConstraint}
          />
        </div>
        <div className="form-field">
          <label htmlFor={`dependency-price-${idPrefix}`}>Max price (atomic USDC)</label>
          <input
            id={`dependency-price-${idPrefix}`}
            inputMode="numeric"
            onChange={(event) => setValues((current) => ({ ...current, maxPriceAtomic: event.target.value }))}
            value={values.maxPriceAtomic}
          />
        </div>
        <div className="form-field">
          <label htmlFor={`dependency-calls-${idPrefix}`}>Max calls (1–5)</label>
          <input
            id={`dependency-calls-${idPrefix}`}
            inputMode="numeric"
            max="5"
            min="1"
            onChange={(event) => setValues((current) => ({ ...current, maxCalls: event.target.value }))}
            type="number"
            value={values.maxCalls}
          />
        </div>
      </div>
      <label className="checkbox-field">
        <input
          checked={values.required}
          onChange={(event) => setValues((current) => ({ ...current, required: event.target.checked }))}
          type="checkbox"
        />
        <span>Required dependency (resolve되지 않으면 quote를 거절)</span>
      </label>
      {validationError ? <p className="form-error" role="alert">{validationError}</p> : null}
      <div className="form-actions">
        <button className="button button--primary" disabled={isSubmitting || (!isEditing && targetAgents.length === 0)} type="submit">
          {isSubmitting ? '저장 중…' : isEditing ? 'Dependency 저장' : 'Dependency 추가'}
        </button>
        {onCancel ? <button className="button button--secondary" disabled={isSubmitting} onClick={onCancel} type="button">취소</button> : null}
      </div>
    </form>
  )
}

function graphForDependencies(agent: AgentModel, dependencies: DependencyModel[]): { edges: DependencyEdgeViewModel[]; nodes: DependencyNodeViewModel[] } {
  const nodes: DependencyNodeViewModel[] = [{ id: agent.id, label: agent.name, description: 'Source Agent' }]
  for (const dependency of dependencies) {
    if (!nodes.some((node) => node.id === dependency.targetAgentId)) {
      nodes.push({ id: dependency.targetAgentId, label: dependency.targetAgentSlug, optional: !dependency.required })
    }
  }
  return {
    edges: dependencies.map((dependency) => ({
      id: dependency.id,
      label: `${dependency.versionConstraint} · ${dependency.maxCalls} call${dependency.maxCalls === 1 ? '' : 's'}`,
      optional: !dependency.required,
      source: agent.id,
      target: dependency.targetAgentId,
    })),
    nodes,
  }
}

export function DependencyEditor({ agent, slug, version }: DependencyEditorProps) {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string>()
  const [cyclePath, setCyclePath] = useState<string[]>()
  const dependenciesQuery = useQuery({
    queryKey: ['dependencies', version.id],
    queryFn: () => listDependencies(version.id),
    enabled: version.status === 'DRAFT',
    retry: false,
  })
  const agentsQuery = useQuery({ queryKey: ['agents'], queryFn: () => listAgents(), retry: false })
  const invalidateDependencyQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dependencies', version.id] }),
      queryClient.invalidateQueries({ queryKey: ['agent', slug] }),
      queryClient.invalidateQueries({ queryKey: ['quote', slug] }),
    ])
  }
  const createMutation = useMutation({
    mutationFn: (input: CreateDependencyInput) => createDependency(version.id, input),
    onError: (error) => setCyclePath(cyclePathFromError(error)),
    onSuccess: async () => { setCyclePath(undefined); await invalidateDependencyQueries() },
  })
  const updateMutation = useMutation({
    mutationFn: ({ dependencyId, input }: { dependencyId: string; input: UpdateDependencyInput }) => updateDependency(version.id, dependencyId, input),
    onError: (error) => setCyclePath(cyclePathFromError(error)),
    onSuccess: async () => { setEditingId(undefined); setCyclePath(undefined); await invalidateDependencyQueries() },
  })
  const deleteMutation = useMutation({
    mutationFn: (dependencyId: string) => removeDependency(version.id, dependencyId),
    onSuccess: invalidateDependencyQueries,
  })

  if (version.status !== 'DRAFT') return null
  if (dependenciesQuery.isPending || agentsQuery.isPending) {
    return <p className="state-card dependency-editor-state" role="status">Dependency 정보를 불러오는 중…</p>
  }
  if (dependenciesQuery.isError || agentsQuery.isError) {
    const error = dependenciesQuery.error ?? agentsQuery.error
    return (
      <div className="state-card state-card--error dependency-editor-state" role="alert">
        <p>{errorMessage(error, 'Dependency 정보를 불러오지 못했습니다.')}</p>
        <button className="button button--secondary" onClick={() => { void dependenciesQuery.refetch(); void agentsQuery.refetch() }} type="button">다시 시도</button>
      </div>
    )
  }

  const dependencies = dependenciesQuery.data
  const agents = agentsQuery.data
  const graph = graphForDependencies(agent, dependencies)
  const activeMutation = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const mutationError = createMutation.error ?? updateMutation.error ?? deleteMutation.error
  return (
    <section className="dependency-editor" aria-labelledby={`dependencies-${version.id}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Draft configuration</p>
          <h2 id={`dependencies-${version.id}`}>v{version.semver} Dependencies</h2>
        </div>
        <span>{dependencies.length}개</span>
      </div>
      {mutationError ? <p className="form-error form-error--summary" role="alert">{errorMessage(mutationError, 'Dependency 저장에 실패했습니다.')}</p> : null}
      {cyclePath ? <p className="dependency-graph__notice dependency-graph__notice--cycle" role="alert"><strong>순환 의존성이 감지되었습니다.</strong> {cyclePath.join(' → ')}</p> : null}
      <DependencyGraphPanel edges={graph.edges} nodes={graph.nodes} state={dependencies.length === 0 ? 'empty' : 'ready'} />
      <div className="dependency-editor__list">
        {dependencies.map((dependency) => (
          <article className="dependency-row" key={dependency.id}>
            {editingId === dependency.id ? (
              <DependencyForm
                agents={agents}
                idPrefix={`${version.id}-${dependency.id}`}
                isSubmitting={updateMutation.isPending}
                onCancel={() => setEditingId(undefined)}
                onSubmit={(input) => updateMutation.mutate({ dependencyId: dependency.id, input })}
                sourceAgentId={agent.id}
                value={dependency}
              />
            ) : (
              <>
                <div>
                  <strong>{dependency.targetAgentSlug}</strong>
                  <p className="version-row__meta">{dependency.versionConstraint} · 최대 {dependency.maxCalls}회 · {dependency.maxPriceLabel}</p>
                  <p className="version-row__meta">{dependency.required ? 'Required' : 'Optional'}</p>
                </div>
                <div className="version-row__actions">
                  <button className="button button--secondary" disabled={activeMutation} onClick={() => setEditingId(dependency.id)} type="button">수정</button>
                  <button className="button button--danger" disabled={activeMutation} onClick={() => deleteMutation.mutate(dependency.id)} type="button">삭제</button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
      <div className="dependency-editor__add">
        <h3>Dependency 추가</h3>
        {agents.length <= 1 ? <p className="state-card__hint">추가할 다른 Agent가 없습니다.</p> : null}
        <DependencyForm
          agents={agents}
          idPrefix={`${version.id}-new`}
          isSubmitting={createMutation.isPending}
          onSubmit={(input) => createMutation.mutate(input as CreateDependencyInput)}
          sourceAgentId={agent.id}
        />
      </div>
    </section>
  )
}
