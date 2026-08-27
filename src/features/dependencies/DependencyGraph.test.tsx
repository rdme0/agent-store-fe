import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DependencyGraph, DependencyGraphPanel, type DependencyEdgeViewModel, type DependencyNodeViewModel } from './DependencyGraph'

const nodes: DependencyNodeViewModel[] = [
  { id: 'planner', label: 'Planner', description: 'Chooses the next action.' },
  { id: 'retriever', label: 'Retriever', optional: true },
  { id: 'executor', label: 'Executor' },
]

const edges: DependencyEdgeViewModel[] = [
  { id: 'planner-retriever', source: 'planner', target: 'retriever', label: 'context' },
  { id: 'retriever-executor', source: 'retriever', target: 'executor' },
]

afterEach(() => {
  cleanup()
})

describe('DependencyGraph', () => {
  it('renders a React Flow graph and accessible list', () => {
    render(<DependencyGraph edges={edges} nodes={nodes} title="Run dependencies" />)

    expect(screen.getByRole('heading', { name: 'Run dependencies' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '의존성 노드' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Planner 의존성' })).toHaveTextContent('Retriever')
    expect(document.querySelector('.react-flow')).toBeInTheDocument()
  })

  it('highlights cycle nodes and cycle edges and announces the path', () => {
    const cycleEdges: DependencyEdgeViewModel[] = [
      { cycle: true, id: 'a-b', source: 'planner', target: 'retriever' },
      { cycle: true, id: 'b-c', source: 'retriever', target: 'executor' },
      { cycle: true, id: 'c-a', source: 'executor', target: 'planner' },
    ]
    render(<DependencyGraph cyclePath={['planner', 'retriever', 'executor']} edges={cycleEdges} nodes={nodes} />)

    expect(screen.getByRole('alert')).toHaveTextContent('순환 의존성이 감지되었습니다. Planner → Retriever → Executor → Planner')
    expect(screen.getByRole('list', { name: 'Planner 의존성' })).toHaveTextContent('Retriever')
  })

  it('normalizes a cycle path that repeats its first node at the end', () => {
    render(
      <DependencyGraph
        cyclePath={['planner', 'retriever', 'executor', 'planner']}
        edges={edges}
        nodes={nodes}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Planner → Retriever → Executor → Planner')
    expect(screen.getByRole('alert')).not.toHaveTextContent('Planner → Planner')
  })

  it('uses edge metadata to avoid highlighting the wrong parallel edge', () => {
    const parallelEdges: DependencyEdgeViewModel[] = [
      { cycle: true, id: 'primary-context', source: 'planner', target: 'retriever' },
      { id: 'fallback-context', source: 'planner', target: 'retriever' },
    ]
    render(<DependencyGraph cyclePath={['planner', 'retriever']} edges={parallelEdges} nodes={nodes} />)

    expect(screen.getByRole('list', { name: 'Planner 의존성' })).toHaveTextContent('Retriever')
  })

  it('shows optional dependency warnings and max cost/budget summary', () => {
    render(
      <DependencyGraph
        costSummary={{ budget: '25', currency: 'USDC', maxCost: '10' }}
        edges={edges}
        nodes={nodes}
        optionalDependencyWarning="Optional dependencies may be skipped."
      />,
    )

    expect(screen.getByRole('note')).toHaveTextContent('Optional dependencies may be skipped.')
    expect(screen.getByText('최대 비용')).toBeInTheDocument()
    expect(screen.getByText('10 USDC')).toBeInTheDocument()
    expect(screen.getByText('25 USDC')).toBeInTheDocument()
  })
})

describe('DependencyGraphPanel states', () => {
  it('renders loading, empty, and disabled states', () => {
    const { rerender } = render(<DependencyGraphPanel edges={[]} nodes={[]} state="loading" />)
    expect(screen.getByRole('status')).toHaveTextContent('의존성 정보를 불러오는 중')

    rerender(<DependencyGraphPanel edges={[]} nodes={[]} state="empty" />)
    expect(screen.getByRole('status')).toHaveTextContent('등록된 의존성이 없습니다')

    rerender(<DependencyGraphPanel edges={edges} nodes={nodes} state="disabled" />)
    expect(screen.getByRole('status', { name: '의존성 실행이 비활성화됨' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: '의존성 실행이 비활성화됨' })).not.toHaveAttribute('aria-disabled')
  })

  it('renders an error state and invokes retry', () => {
    const onRetry = vi.fn()
    render(<DependencyGraphPanel edges={[]} errorMessage="Graph request failed." nodes={[]} onRetry={onRetry} state="error" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Graph request failed.')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('uses the empty state when ready data has no nodes', () => {
    render(<DependencyGraphPanel edges={[]} nodes={[]} />)
    expect(screen.getByRole('status')).toHaveTextContent('등록된 의존성이 없습니다')
  })
})
