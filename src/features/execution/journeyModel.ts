import { formatAtomicUsdc } from '../../entities/agent/model'
import type { QuoteSnapshot } from '../../entities/dependency/model'
import type { ExecutionDto } from '../../entities/execution/api'
import type { ExecutionTimelineState } from './model'

export type ExecutionJourneyStatus =
  | 'planned'
  | 'preparing'
  | 'active'
  | 'completed'
  | 'failed'
  | 'reconciliation'
  | 'not-used'

export interface ExecutionJourneyNode {
  id: string
  agentName: string
  agentDescription: string
  agentVersionId: string
  semver?: string
  depth: number
  status: ExecutionJourneyStatus
  callCount: number
  completedCallCount: number
  hasConfirmedCost: boolean
  costAtomic: string
  costLabel: string
  paymentStatuses: string[]
  children: ExecutionJourneyNode[]
}

export interface ExecutionJourneyModel {
  roots: ExecutionJourneyNode[]
  totalCount: number
  completedCount: number
  activeMessage: string
  activePathIds: string[]
  statusEntries: Array<Pick<ExecutionJourneyNode, 'id' | 'agentName' | 'depth' | 'status'>>
  terminal: boolean
}

interface JourneySourceNode {
  id: string
  agentName: string
  agentDescription: string
  agentVersionId: string
  semver?: string
  depth: number
  children: JourneySourceNode[]
}

interface BuildContext {
  statusByStepId: Map<string, string>
  errorByStepId: Map<string, string | undefined>
  stepsByParentId: Map<string, ExecutionDto['steps']>
  claimedStepIds: Set<string>
  terminal: boolean
}

const ROOT_PARENT_ID = '__root__'

function displayName(snapshot: QuoteSnapshot): string {
  return snapshot.version.agentName?.trim() || snapshot.version.agentCode || '분석 단계'
}

function displayDescription(snapshot: QuoteSnapshot): string {
  return snapshot.version.agentDescription?.trim()
    || `${displayName(snapshot)}에서 필요한 내용을 확인해요.`
}

function sourceTree(snapshot: QuoteSnapshot, depth = 0, path = 'root'): JourneySourceNode {
  return {
    id: `${path}:${snapshot.version.id}`,
    agentName: displayName(snapshot),
    agentDescription: displayDescription(snapshot),
    agentVersionId: snapshot.version.id,
    semver: snapshot.version.semver,
    depth,
    children: snapshot.dependencies.map((dependency, index) => {
      const dependencyPath = `${path}/${dependency.dependencyId || index}`
      if (dependency.resolved) return sourceTree(dependency.resolved, depth + 1, dependencyPath)

      const agentName = dependency.targetAgentCode
        || dependency.selection?.functionCode
        || '추가 분석 단계'
      return {
        id: `${dependencyPath}:unresolved`,
        agentName,
        agentDescription: `${agentName}에서 필요한 내용을 확인해요.`,
        agentVersionId: `unresolved:${dependency.dependencyId}`,
        depth: depth + 1,
        children: [],
      }
    }),
  }
}

function actualSourceTree(execution: ExecutionDto): JourneySourceNode[] {
  const childrenByParent = new Map<string, ExecutionDto['steps']>()
  execution.steps.forEach((step) => {
    const parentId = step.parentStepId ?? ROOT_PARENT_ID
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), step])
  })

  function groupByVersion(steps: ExecutionDto['steps']): ExecutionDto['steps'][] {
    const groups = new Map<string, ExecutionDto['steps']>()
    steps.forEach((step) => {
      groups.set(step.agentVersionId, [...(groups.get(step.agentVersionId) ?? []), step])
    })
    return [...groups.values()]
  }

  function visit(steps: ExecutionDto['steps'], depth: number, path: string): JourneySourceNode {
    const first = steps[0]
    const name = first.agentName?.trim() || first.agentCode?.trim() || '분석 단계'
    const children = steps.flatMap((step) => childrenByParent.get(step.id) ?? [])
    return {
      id: `actual:${path}:${first.agentVersionId}`,
      agentName: name,
      agentDescription: `${name}에서 필요한 내용을 확인해요.`,
      agentVersionId: first.agentVersionId,
      depth,
      children: groupByVersion(children).map((group, index) => visit(group, depth + 1, `${path}/${index}`)),
    }
  }

  return groupByVersion(childrenByParent.get(ROOT_PARENT_ID) ?? [])
    .map((group, index) => visit(group, 0, index.toString()))
}

function confirmedCost(step: ExecutionDto['steps'][number]): { amount: bigint; confirmed: boolean } {
  const settledPayments = step.payments.filter((payment) => payment.status === 'SETTLED')
  if (settledPayments.length > 0) {
    return {
      amount: settledPayments.reduce((sum, payment) => sum + BigInt(payment.amountAtomic), 0n),
      confirmed: true,
    }
  }
  if (step.status === 'COMPLETED') {
    return { amount: BigInt(step.costAtomic), confirmed: true }
  }
  return { amount: 0n, confirmed: false }
}

function confirmedCosts(steps: ExecutionDto['steps']): { amountAtomic: string; confirmed: boolean } {
  const costs = steps.map(confirmedCost)
  return {
    amountAtomic: costs.reduce((sum, cost) => sum + cost.amount, 0n).toString(),
    confirmed: costs.some((cost) => cost.confirmed),
  }
}

function actualStatus(step: ExecutionDto['steps'][number], context: BuildContext): string {
  return context.statusByStepId.get(step.id) ?? step.status
}

function hasReconciliation(step: ExecutionDto['steps'][number], context: BuildContext): boolean {
  return step.payments.some((payment) => payment.status === 'RECONCILIATION_REQUIRED')
    || context.errorByStepId.get(step.id) === 'PAYMENT_RECONCILIATION_REQUIRED'
}

function nodeStatus(
  steps: ExecutionDto['steps'],
  parentSteps: ExecutionDto['steps'] | undefined,
  context: BuildContext,
): ExecutionJourneyStatus {
  if (steps.length === 0) {
    const parentFinished = parentSteps !== undefined
      && parentSteps.length > 0
      && parentSteps.every((step) => {
        const status = actualStatus(step, context)
        return status === 'COMPLETED' || status === 'FAILED'
      })
    return context.terminal || parentFinished ? 'not-used' : 'planned'
  }
  if (steps.some((step) => hasReconciliation(step, context))) return 'reconciliation'

  const statuses = steps.map((step) => actualStatus(step, context))
  if (statuses.some((status) => status === 'FAILED')) return 'failed'
  if (statuses.some((status) => status === 'RUNNING' || status === 'PAYMENT_SETTLED')) return 'active'
  if (statuses.some((status) => status === 'CREATED' || status === 'PAYMENT_REQUIRED')) return 'preparing'
  if (statuses.every((status) => status === 'COMPLETED')) return 'completed'
  return 'preparing'
}

function buildNode(
  source: JourneySourceNode,
  parentSteps: ExecutionDto['steps'] | undefined,
  context: BuildContext,
): ExecutionJourneyNode {
  const candidates = parentSteps === undefined
    ? context.stepsByParentId.get(ROOT_PARENT_ID) ?? []
    : parentSteps.flatMap((parent) => context.stepsByParentId.get(parent.id) ?? [])
  const steps = candidates.filter((step) => (
    step.agentVersionId === source.agentVersionId && !context.claimedStepIds.has(step.id)
  ))
  steps.forEach((step) => context.claimedStepIds.add(step.id))

  const costs = confirmedCosts(steps)
  return {
    id: source.id,
    agentName: source.agentName,
    agentDescription: source.agentDescription,
    agentVersionId: source.agentVersionId,
    semver: source.semver,
    depth: source.depth,
    status: nodeStatus(steps, parentSteps, context),
    callCount: steps.length,
    completedCallCount: steps.filter((step) => actualStatus(step, context) === 'COMPLETED').length,
    hasConfirmedCost: costs.confirmed,
    costAtomic: costs.amountAtomic,
    costLabel: formatAtomicUsdc(costs.amountAtomic),
    paymentStatuses: [...new Set(steps.flatMap((step) => step.payments.map((payment) => payment.status)))],
    children: source.children.map((child) => buildNode(child, steps, context)),
  }
}

function flatten(nodes: ExecutionJourneyNode[]): ExecutionJourneyNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)])
}

function currentNode(nodes: ExecutionJourneyNode[]): ExecutionJourneyNode | undefined {
  return [...nodes]
    .filter((node) => node.status === 'active' || node.status === 'preparing')
    .sort((left, right) => right.depth - left.depth)[0]
}

function pathToNode(nodes: ExecutionJourneyNode[], targetId: string): string[] {
  for (const node of nodes) {
    if (node.id === targetId) return [node.id]

    const childPath = pathToNode(node.children, targetId)
    if (childPath.length > 0) return [node.id, ...childPath]
  }

  return []
}

export function buildExecutionJourney(
  snapshot: QuoteSnapshot | undefined,
  execution: ExecutionDto,
  timeline: ExecutionTimelineState,
): ExecutionJourneyModel {
  const sources = snapshot ? [sourceTree(snapshot)] : actualSourceTree(execution)
  const stepsByParentId = new Map<string, ExecutionDto['steps']>()
  execution.steps.forEach((step) => {
    const parentId = step.parentStepId ?? ROOT_PARENT_ID
    stepsByParentId.set(parentId, [...(stepsByParentId.get(parentId) ?? []), step])
  })
  const context: BuildContext = {
    statusByStepId: new Map(timeline.steps.map((step) => [step.id, step.status])),
    errorByStepId: new Map(timeline.steps.map((step) => [step.id, step.error?.code])),
    stepsByParentId,
    claimedStepIds: new Set<string>(),
    terminal: execution.status === 'COMPLETED'
      || execution.status === 'FAILED'
      || timeline.status === 'succeeded'
      || timeline.status === 'failed',
  }
  const roots = sources.map((source) => buildNode(source, undefined, context))
  const nodes = flatten(roots)
  const active = currentNode(nodes)

  return {
    roots,
    totalCount: nodes.length,
    completedCount: nodes.filter((node) => node.status === 'completed').length,
    activeMessage: active
      ? `${active.agentName}에서 필요한 내용을 확인하고 있어요.`
      : context.terminal
        ? '모든 분석 단계의 상태를 확인했어요.'
        : '분석을 시작할 준비를 하고 있어요.',
    activePathIds: active ? pathToNode(roots, active.id) : [],
    statusEntries: nodes.map((node) => ({
      id: node.id,
      agentName: node.agentName,
      depth: node.depth,
      status: node.status,
    })),
    terminal: context.terminal,
  }
}

export function journeyStatusLabel(status: ExecutionJourneyStatus): string {
  const labels: Record<ExecutionJourneyStatus, string> = {
    planned: '예정',
    preparing: '준비 중',
    active: '확인 중',
    completed: '확인 완료',
    failed: '문제가 생겼어요',
    reconciliation: '결제 확인 중',
    'not-used': '이번 답변에는 사용되지 않았어요',
  }
  return labels[status]
}
