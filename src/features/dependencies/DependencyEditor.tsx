import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { listAgents } from '../../entities/agent/api'
import type { AgentModel, AgentVersionModel } from '../../entities/agent/model'
import { listFunctionContracts } from '../../entities/function-contract/api'
import {
  createDependency,
  listDependencies,
  removeDependency,
  updateDependency,
  type CreateDependencyInput,
  type UpdateDependencyInput,
} from '../../entities/dependency/api'
import type { DependencyModel } from '../../entities/dependency/model'
import type { FunctionContractResponse } from '../../generated'
import { ApiRequestError } from '../../shared/api/client'
import { DependencyGraphPanel, type DependencyEdgeViewModel, type DependencyNodeViewModel } from './DependencyGraph'

interface DependencyEditorProps {
  agent: AgentModel
  code: string
  version: AgentVersionModel
}

interface DependencyFormProps {
  agents: AgentModel[]
  functionContracts: FunctionContractResponse[]
  idPrefix: string
  isSubmitting: boolean
  onCancel?: () => void
  onSubmit: (input: CreateDependencyInput | UpdateDependencyInput) => void
  sourceAgentId: string
  value?: DependencyModel
}

interface FormValues {
  allowedProviderAgentIds: string[]
  explorationPercent: string
  functionContractId: string
  maxCalls: string
  maxPriceAtomic: string
  maxP95LatencyMillis: string
  minReliabilityPercent: string
  priceWeight: string
  providerScope: '' | 'pinned' | 'allowlist' | 'marketplace'
  required: boolean
  reliabilityWeight: string
  selectionStrategy: '' | 'lowest_price' | 'latest_version' | 'highest_reliability' | 'fastest' | 'balanced'
  speedWeight: string
  targetAgentId: string
  targetMode: 'direct' | 'function'
  versionConstraint: string
}

function initialValues(value?: DependencyModel): FormValues {
  return {
    allowedProviderAgentIds: [],
    explorationPercent: String(value?.explorationPercent ?? 0),
    functionContractId: value?.functionContractId ?? '',
    maxCalls: String(value?.maxCalls ?? 1),
    maxPriceAtomic: value?.maxPriceAtomic ?? '',
    maxP95LatencyMillis: value?.maxP95LatencyMillis?.toString() ?? '',
    minReliabilityPercent: value?.minReliabilityPercent?.toString() ?? '',
    priceWeight: value?.priceWeight?.toString() ?? '',
    providerScope: value?.providerScope ?? (value ? '' : 'marketplace'),
    required: value?.required ?? true,
    reliabilityWeight: value?.reliabilityWeight?.toString() ?? '',
    selectionStrategy: value?.selectionStrategy ?? '',
    speedWeight: value?.speedWeight?.toString() ?? '',
    targetAgentId: value?.targetAgentId ?? '',
    targetMode: value?.targetAgentId && !value.functionContractId ? 'direct' : 'function',
    versionConstraint: value?.versionConstraint ?? '>=1.0.0,<2.0.0',
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : undefined
}

function providerScopeLabel(scope: NonNullable<DependencyModel['providerScope']>): string {
  return {
    pinned: '특정 Agent 고정',
    allowlist: '허용 Agent 안에서 선택',
    marketplace: 'Marketplace 선택',
  }[scope]
}

function strategyLabel(strategy: NonNullable<DependencyModel['selectionStrategy']>): string {
  return {
    lowest_price: '최저 가격',
    latest_version: '최신 Version',
    highest_reliability: '가장 높은 신뢰도',
    fastest: '가장 빠른 응답',
    balanced: '균형 선택',
  }[strategy]
}

function cyclePathFromError(error: unknown): string[] | undefined {
  if (!(error instanceof ApiRequestError) || (error.errorCode !== 'DEPENDENCY_409_003' && error.errorCode !== 'DEPENDENCY_CYCLE_DETECTED')) return undefined
  const marker = '경로:'
  const markerIndex = error.message.indexOf(marker)
  if (markerIndex < 0) return undefined
  const cycle = error.message
    .slice(markerIndex + marker.length)
    .split(' -> ')
    .map((value) => value.trim())
    .filter(Boolean)
  return cycle.length >= 2 ? cycle : undefined
}

function DependencyForm({ agents, functionContracts, idPrefix, isSubmitting, onCancel, onSubmit, sourceAgentId, value }: DependencyFormProps) {
  const [values, setValues] = useState(() => initialValues(value))
  const [validationError, setValidationError] = useState<string>()
  const isEditing = Boolean(value)
  const targetAgents = agents.filter((agent) => agent.id !== sourceAgentId)
  const requiresStrategy = values.targetMode === 'function' &&
    (values.providerScope === 'allowlist' || values.providerScope === 'marketplace')
  const hasAvailableTarget = values.targetMode === 'direct'
    ? targetAgents.length > 0
    : functionContracts.length > 0 && (values.providerScope !== 'pinned' || targetAgents.length > 0)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const maxCalls = Number(values.maxCalls)
    const explorationPercent = Number(values.explorationPercent)
    const minReliabilityPercent = optionalNumber(values.minReliabilityPercent)
    const maxP95LatencyMillis = optionalNumber(values.maxP95LatencyMillis)
    const reliabilityWeight = optionalNumber(values.reliabilityWeight)
    const priceWeight = optionalNumber(values.priceWeight)
    const speedWeight = optionalNumber(values.speedWeight)
    if (!isEditing && values.targetMode === 'function' && !values.functionContractId) {
      setValidationError('필요한 기능 계약을 선택하세요.')
      return
    }
    if (!isEditing && values.targetMode === 'function' && !values.providerScope) {
      setValidationError('공급자 범위를 선택하세요.')
      return
    }
    if ((values.targetMode === 'direct' || values.providerScope === 'pinned') && !values.targetAgentId) {
      setValidationError('고정할 Agent를 선택하세요.')
      return
    }
    if (values.providerScope === 'allowlist' && values.allowedProviderAgentIds.length === 0) {
      setValidationError('허용할 Agent를 하나 이상 선택하세요.')
      return
    }
    if (requiresStrategy && !values.selectionStrategy) {
      setValidationError('공급자 선택 정책을 선택하세요.')
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
    if (!Number.isInteger(explorationPercent) || explorationPercent < 0 || explorationPercent > 20) {
      setValidationError('탐색 비율은 0에서 20 사이의 정수여야 합니다.')
      return
    }
    if (minReliabilityPercent !== undefined && (minReliabilityPercent < 0 || minReliabilityPercent > 100)) {
      setValidationError('최소 신뢰도는 0에서 100 사이여야 합니다.')
      return
    }
    if (maxP95LatencyMillis !== undefined && maxP95LatencyMillis < 1) {
      setValidationError('최대 p95 지연 시간은 1ms 이상이어야 합니다.')
      return
    }
    if (values.selectionStrategy === 'balanced') {
      if (reliabilityWeight === undefined || priceWeight === undefined || speedWeight === undefined || reliabilityWeight + priceWeight + speedWeight !== 100) {
        setValidationError('균형 전략의 신뢰도·가격·속도 가중치 합계는 100이어야 합니다.')
        return
      }
    }
    setValidationError(undefined)
    const selection = values.targetMode === 'function' ? {
      allowedProviderAgentIds: values.providerScope === 'allowlist' ? values.allowedProviderAgentIds : undefined,
      explorationPercent,
      maxP95LatencyMillis,
      minReliabilityPercent,
      priceWeight: values.selectionStrategy === 'balanced' ? priceWeight : undefined,
      providerScope: values.providerScope || undefined,
      reliabilityWeight: values.selectionStrategy === 'balanced' ? reliabilityWeight : undefined,
      selectionStrategy: requiresStrategy ? values.selectionStrategy || undefined : undefined,
      speedWeight: values.selectionStrategy === 'balanced' ? speedWeight : undefined,
    } : {}
    if (isEditing) {
      onSubmit({
        maxCalls,
        maxPriceAtomic: values.maxPriceAtomic,
        required: values.required,
        ...selection,
        versionConstraint: values.versionConstraint.trim(),
      })
    } else {
      onSubmit({
        maxCalls,
        maxPriceAtomic: values.maxPriceAtomic,
        required: values.required,
        functionContractId: values.targetMode === 'function' ? values.functionContractId : undefined,
        targetAgentId: values.targetMode === 'direct' || values.providerScope === 'pinned' ? values.targetAgentId : undefined,
        ...selection,
        versionConstraint: values.versionConstraint.trim(),
      })
    }
  }

  return (
    <form className="dependency-form" onSubmit={submit}>
      <div className="form-grid">
        {!isEditing ? <div className="form-field">
          <label htmlFor={`dependency-target-mode-${idPrefix}`}>의존성 대상</label>
          <select id={`dependency-target-mode-${idPrefix}`} onChange={(event) => setValues((current) => ({ ...current, targetAgentId: '', targetMode: event.target.value as FormValues['targetMode'] }))} value={values.targetMode}>
            <option value="function">기능을 제공하는 Agent 자동 선택</option>
            <option value="direct">특정 Agent 직접 호출</option>
          </select>
        </div> : null}
        {values.targetMode === 'function' ? <div className="form-field">
          <label htmlFor={`dependency-function-${idPrefix}`}>필요한 기능</label>
          {isEditing ? (
            <output className="form-output" id={`dependency-function-${idPrefix}`}>
              {value?.functionCode ?? value?.targetAgentCode ?? '특정 Agent 직접 호출'}
            </output>
          ) : (
            <select id={`dependency-function-${idPrefix}`} onChange={(event) => setValues((current) => ({ ...current, functionContractId: event.target.value }))} value={values.functionContractId}>
              <option value="">기능 계약 선택</option>
              {functionContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.name} · {contract.code} v{contract.contractVersion}</option>)}
            </select>
          )}
        </div> : null}
        {values.targetMode === 'function' ? <div className="form-field">
          <label htmlFor={`dependency-scope-${idPrefix}`}>공급자 범위</label>
          <select disabled={isEditing} id={`dependency-scope-${idPrefix}`} onChange={(event) => setValues((current) => ({ ...current, providerScope: event.target.value as FormValues['providerScope'], selectionStrategy: '' }))} value={values.providerScope}>
            <option value="">범위 선택</option>
            <option value="pinned">특정 Agent로 고정</option>
            <option value="allowlist">허용한 Agent 안에서 선택</option>
            <option value="marketplace">Marketplace 전체에서 선택</option>
          </select>
          {isEditing ? <p className="form-field__help">기존 의존성의 공급자 범위는 새 의존성을 만들어 바꿉니다.</p> : null}
        </div> : null}
        {values.targetMode === 'direct' || values.providerScope === 'pinned' ? (
          <div className="form-field">
            <label htmlFor={`dependency-target-${idPrefix}`}>{values.targetMode === 'direct' ? '호출할 Agent' : '고정 Agent'}</label>
            <select disabled={isEditing} id={`dependency-target-${idPrefix}`} onChange={(event) => setValues((current) => ({ ...current, targetAgentId: event.target.value }))} value={values.targetAgentId}>
              <option value="">Agent 선택</option>
              {targetAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.code}</option>)}
            </select>
          </div>
        ) : null}
        {values.targetMode === 'function' && values.providerScope === 'allowlist' ? (
          <div className="form-field">
            <label htmlFor={`dependency-allowlist-${idPrefix}`}>허용 Agent</label>
            <select disabled={isEditing} id={`dependency-allowlist-${idPrefix}`} multiple onChange={(event) => setValues((current) => ({ ...current, allowedProviderAgentIds: Array.from(event.target.selectedOptions, (option) => option.value) }))} value={values.allowedProviderAgentIds}>
              {targetAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.code}</option>)}
            </select>
          </div>
        ) : null}
        {requiresStrategy ? (
          <div className="form-field">
            <label htmlFor={`dependency-strategy-${idPrefix}`}>선택 전략</label>
            <select id={`dependency-strategy-${idPrefix}`} onChange={(event) => setValues((current) => ({ ...current, selectionStrategy: event.target.value as FormValues['selectionStrategy'] }))} value={values.selectionStrategy}>
              <option value="">정책 선택</option>
              <option value="lowest_price">최저 가격</option>
              <option value="latest_version">최신 Version</option>
              <option value="highest_reliability">가장 높은 신뢰도</option>
              <option value="fastest">가장 빠른 응답</option>
              <option value="balanced">균형 선택</option>
            </select>
          </div>
        ) : null}
        <div className="form-field">
          <label htmlFor={`dependency-constraint-${idPrefix}`}>Version constraint</label>
          <input
            id={`dependency-constraint-${idPrefix}`}
            onChange={(event) => setValues((current) => ({ ...current, versionConstraint: event.target.value }))}
            value={values.versionConstraint}
          />
          <p className="form-field__help">예: ==1.0.0 또는 &gt;=1.0.0,&lt;2.0.0. 여러 조건은 모두 충족해야 합니다.</p>
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
        {requiresStrategy ? <>
          <div className="form-field">
            <label htmlFor={`dependency-exploration-${idPrefix}`}>신규 공급자 탐색 비율 (0–20%)</label>
            <input id={`dependency-exploration-${idPrefix}`} inputMode="numeric" max="20" min="0" onChange={(event) => setValues((current) => ({ ...current, explorationPercent: event.target.value }))} type="number" value={values.explorationPercent} />
          </div>
          <div className="form-field">
            <label htmlFor={`dependency-reliability-${idPrefix}`}>최소 신뢰도 (%)</label>
            <input id={`dependency-reliability-${idPrefix}`} inputMode="numeric" max="100" min="0" onChange={(event) => setValues((current) => ({ ...current, minReliabilityPercent: event.target.value }))} type="number" value={values.minReliabilityPercent} />
          </div>
          <div className="form-field">
            <label htmlFor={`dependency-latency-${idPrefix}`}>최대 p95 지연 시간 (ms)</label>
            <input id={`dependency-latency-${idPrefix}`} inputMode="numeric" min="1" onChange={(event) => setValues((current) => ({ ...current, maxP95LatencyMillis: event.target.value }))} type="number" value={values.maxP95LatencyMillis} />
          </div>
        </> : null}
        {values.selectionStrategy === 'balanced' ? <>
          <div className="form-field">
            <label htmlFor={`dependency-weight-reliability-${idPrefix}`}>신뢰도 가중치</label>
            <input id={`dependency-weight-reliability-${idPrefix}`} inputMode="numeric" max="100" min="0" onChange={(event) => setValues((current) => ({ ...current, reliabilityWeight: event.target.value }))} type="number" value={values.reliabilityWeight} />
          </div>
          <div className="form-field">
            <label htmlFor={`dependency-weight-price-${idPrefix}`}>가격 가중치</label>
            <input id={`dependency-weight-price-${idPrefix}`} inputMode="numeric" max="100" min="0" onChange={(event) => setValues((current) => ({ ...current, priceWeight: event.target.value }))} type="number" value={values.priceWeight} />
          </div>
          <div className="form-field">
            <label htmlFor={`dependency-weight-speed-${idPrefix}`}>속도 가중치</label>
            <input id={`dependency-weight-speed-${idPrefix}`} inputMode="numeric" max="100" min="0" onChange={(event) => setValues((current) => ({ ...current, speedWeight: event.target.value }))} type="number" value={values.speedWeight} />
          </div>
        </> : null}
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
        <button className="button button--primary" disabled={isSubmitting || (!isEditing && !hasAvailableTarget)} type="submit">
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
    const targetId = dependency.targetAgentId ?? dependency.functionContractId ?? dependency.id
    if (!nodes.some((node) => node.id === targetId)) {
      nodes.push({ id: targetId, label: dependency.targetAgentCode ?? dependency.functionCode ?? '기능 계약', optional: !dependency.required })
    }
  }
  return {
    edges: dependencies.map((dependency) => ({
      id: dependency.id,
      label: `${dependency.versionConstraint} · ${dependency.maxCalls} call${dependency.maxCalls === 1 ? '' : 's'}`,
      optional: !dependency.required,
      source: agent.id,
      target: dependency.targetAgentId ?? dependency.functionContractId ?? dependency.id,
    })),
    nodes,
  }
}

export function DependencyEditor({ agent, code, version }: DependencyEditorProps) {
  const queryClient = useQueryClient()
  const mutationLocked = useRef(false)
  const [editingId, setEditingId] = useState<string>()
  const [cyclePath, setCyclePath] = useState<string[]>()
  const dependenciesQuery = useQuery({
    queryKey: ['dependencies', version.id],
    queryFn: () => listDependencies(version.id),
    enabled: version.status === 'DRAFT',
    retry: false,
  })
  const agentsQuery = useQuery({
    queryKey: ['agents', 'developer'],
    queryFn: () => listAgents({ view: 'developer' }),
    retry: false,
  })
  const functionContractsQuery = useQuery({
    queryKey: ['function-contracts'],
    queryFn: listFunctionContracts,
    retry: false,
  })
  const invalidateDependencyQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dependencies', version.id] }),
      queryClient.invalidateQueries({ queryKey: ['agent', code] }),
      queryClient.invalidateQueries({ queryKey: ['quote', code] }),
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

  function createLocked(input: CreateDependencyInput) {
    if (mutationLocked.current) return
    mutationLocked.current = true
    createMutation.mutate(input, {
      onSettled: () => { mutationLocked.current = false },
    })
  }

  function updateLocked(dependencyId: string, input: UpdateDependencyInput) {
    if (mutationLocked.current) return
    mutationLocked.current = true
    updateMutation.mutate({ dependencyId, input }, {
      onSettled: () => { mutationLocked.current = false },
    })
  }

  function deleteLocked(dependencyId: string) {
    if (mutationLocked.current) return
    mutationLocked.current = true
    deleteMutation.mutate(dependencyId, {
      onSettled: () => { mutationLocked.current = false },
    })
  }

  if (version.status !== 'DRAFT') return null
  if (dependenciesQuery.isPending || agentsQuery.isPending || functionContractsQuery.isPending) {
    return <p className="state-card dependency-editor-state" role="status">Dependency 정보를 불러오는 중…</p>
  }
  if (dependenciesQuery.isError || agentsQuery.isError || functionContractsQuery.isError) {
    const error = dependenciesQuery.error ?? agentsQuery.error ?? functionContractsQuery.error
    return (
      <div className="state-card state-card--error dependency-editor-state" role="alert">
        <p>{errorMessage(error, 'Dependency 정보를 불러오지 못했습니다.')}</p>
        <button className="button button--secondary" onClick={() => { void dependenciesQuery.refetch(); void agentsQuery.refetch(); void functionContractsQuery.refetch() }} type="button">다시 시도</button>
      </div>
    )
  }

  const dependencies = dependenciesQuery.data
  const agents = agentsQuery.data
  const functionContracts = functionContractsQuery.data
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
                functionContracts={functionContracts}
                idPrefix={`${version.id}-${dependency.id}`}
                isSubmitting={updateMutation.isPending}
                onCancel={() => setEditingId(undefined)}
                onSubmit={(input) => updateLocked(dependency.id, input)}
                sourceAgentId={agent.id}
                value={dependency}
              />
            ) : (
              <>
                <div>
                  <strong>{dependency.targetAgentCode ?? dependency.functionCode ?? '기능 계약'}</strong>
                  <p className="version-row__meta">{dependency.versionConstraint} · 최대 {dependency.maxCalls}회 · {dependency.maxPriceLabel}</p>
                  <p className="version-row__meta">{dependency.required ? '필수' : '선택'}{dependency.providerScope ? ` · ${providerScopeLabel(dependency.providerScope)}` : ''}{dependency.selectionStrategy ? ` · ${strategyLabel(dependency.selectionStrategy)}` : ''}</p>
                </div>
                <div className="version-row__actions">
                  <button className="button button--secondary" disabled={activeMutation} onClick={() => setEditingId(dependency.id)} type="button">수정</button>
                  <button className="button button--danger" disabled={activeMutation} onClick={() => deleteLocked(dependency.id)} type="button">삭제</button>
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
          functionContracts={functionContracts}
          idPrefix={`${version.id}-new`}
          isSubmitting={createMutation.isPending}
          onSubmit={(input) => createLocked(input as CreateDependencyInput)}
          sourceAgentId={agent.id}
        />
      </div>
    </section>
  )
}
