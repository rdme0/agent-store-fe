import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExecutionTimelinePanel } from './ExecutionTimeline'
import { applyExecutionEvents } from './reducer'

afterEach(() => {
  cleanup()
})

describe('ExecutionTimelinePanel states', () => {
  it('renders loading, empty, and disabled states', () => {
    const { rerender } = render(<ExecutionTimelinePanel state="loading" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading execution')

    rerender(<ExecutionTimelinePanel state="empty" />)
    expect(screen.getByRole('status')).toHaveTextContent('No execution events yet')

    rerender(<ExecutionTimelinePanel disabledMessage="Execution is unavailable." state="disabled" />)
    expect(screen.getByRole('status')).toHaveTextContent('Execution is unavailable.')
  })

  it('renders an error state and invokes retry', () => {
    const onRetry = vi.fn()
    render(<ExecutionTimelinePanel errorMessage="Stream request failed." onRetry={onRetry} state="error" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Stream request failed.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe('ExecutionTimeline', () => {
  it('renders an accessible timeline with status, cost, payment, and errors', () => {
    const timeline = applyExecutionEvents([
      {
        id: 'event-1',
        sequence: 1,
        status: 'failed',
        error: { code: 'AGENT_FAILED', message: 'The agent returned an error.' },
        cost: { amount: '0.50', currency: 'USDC' },
        step: {
          id: 'call-agent',
          label: 'Call agent',
          status: 'failed',
          description: 'Sends the request to the selected agent.',
          cost: { amount: '0.50', currency: 'USDC' },
          error: { message: 'Agent response was not accepted.' },
        },
        payment: {
          status: 'failed',
          amount: { amount: '0.50', currency: 'USDC' },
          reference: 'payment-42',
          error: { message: 'Payment was declined.' },
        },
      },
    ])

    render(<ExecutionTimelinePanel state="ready" timeline={timeline} title="Run #42" />)

    expect(screen.getByRole('heading', { name: 'Run #42' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Execution steps' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Call agent: Failed' })).toBeInTheDocument()
    expect(screen.getAllByText('0.50 USDC')).toHaveLength(3)
    expect(screen.getByRole('heading', { name: 'Payment' })).toBeInTheDocument()
    expect(screen.getByText('payment-42')).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(3)
  })

  it('keeps reconnecting visible as a textual connection status', () => {
    const timeline = applyExecutionEvents([
      { id: 'event-1', sequence: 1, status: 'running' },
    ], { connection: 'reconnecting' })

    render(<ExecutionTimelinePanel state="ready" timeline={timeline} />)

    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting to live updates')
  })
})
