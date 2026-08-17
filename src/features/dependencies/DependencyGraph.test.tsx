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
  it('renders nodes and edges through the visual graph and accessible list', () => {
    render(<DependencyGraph edges={edges} nodes={nodes} title="Run dependencies" />)

    expect(screen.getByRole('heading', { name: 'Run dependencies' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Dependency nodes' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Planner dependencies' })).toHaveTextContent('Retriever')
    expect(screen.getByTestId('dependency-graph-canvas')).toBeInTheDocument()
    expect(document.querySelector('[data-edge-id="planner-retriever"]')).toBeInTheDocument()
    expect(screen.getByText('Optional')).toBeInTheDocument()
  })

  it('highlights cycle nodes and cycle edges and announces the path', () => {
    const cycleEdges: DependencyEdgeViewModel[] = [
      { cycle: true, id: 'a-b', source: 'planner', target: 'retriever' },
      { cycle: true, id: 'b-c', source: 'retriever', target: 'executor' },
      { cycle: true, id: 'c-a', source: 'executor', target: 'planner' },
    ]
    render(<DependencyGraph cyclePath={['planner', 'retriever', 'executor']} edges={cycleEdges} nodes={nodes} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Cycle detected. Planner → Retriever → Executor → Planner')
    expect(document.querySelector('[data-node-id="planner"]')).toHaveClass('dependency-graph__node--cycle')
    expect(document.querySelector('[data-edge-id="a-b"]')).toHaveClass('dependency-graph__edge--cycle')
    expect(document.querySelector('.dependency-graph__edge-item[data-edge-id="c-a"]')).toHaveClass('dependency-graph__edge-item--cycle')
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

    expect(document.querySelector('.dependency-graph__edge[data-edge-id="primary-context"]')).toHaveClass('dependency-graph__edge--cycle')
    expect(document.querySelector('.dependency-graph__edge[data-edge-id="fallback-context"]')).not.toHaveClass('dependency-graph__edge--cycle')
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
    expect(screen.getByText('Maximum cost')).toBeInTheDocument()
    expect(screen.getByText('10 USDC')).toBeInTheDocument()
    expect(screen.getByText('25 USDC')).toBeInTheDocument()
  })
})

describe('DependencyGraphPanel states', () => {
  it('renders loading, empty, and disabled states', () => {
    const { rerender } = render(<DependencyGraphPanel edges={[]} nodes={[]} state="loading" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading dependencies')

    rerender(<DependencyGraphPanel edges={[]} nodes={[]} state="empty" />)
    expect(screen.getByRole('status')).toHaveTextContent('No dependencies configured')

    rerender(<DependencyGraphPanel edges={edges} nodes={nodes} state="disabled" />)
    expect(screen.getByRole('status', { name: 'Dependencies disabled' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Dependencies disabled' })).not.toHaveAttribute('aria-disabled')
  })

  it('renders an error state and invokes retry', () => {
    const onRetry = vi.fn()
    render(<DependencyGraphPanel edges={[]} errorMessage="Graph request failed." nodes={[]} onRetry={onRetry} state="error" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Graph request failed.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('uses the empty state when ready data has no nodes', () => {
    render(<DependencyGraphPanel edges={[]} nodes={[]} />)
    expect(screen.getByRole('status')).toHaveTextContent('No dependencies configured')
  })
})
