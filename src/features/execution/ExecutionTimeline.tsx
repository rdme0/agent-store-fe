import { useId } from 'react'
import {
  createExecutionTimelineState,
  type ExecutionPanelState,
  type ExecutionTimelineState,
} from './model'
import {
  createExecutionTimelineViewModel,
  statusClassName,
  type ExecutionTimelineViewModel,
  type ExecutionTimelineViewModelOptions,
} from './viewModel'
import './execution.css'

export interface ExecutionTimelineProps extends ExecutionTimelineViewModelOptions {
  timeline?: ExecutionTimelineState
  viewModel?: ExecutionTimelineViewModel
  onRetry?: () => void
}

function PanelState({
  model,
  onRetry,
}: {
  model: ExecutionTimelineViewModel
  onRetry?: () => void
}) {
  if (model.panelState === 'loading') {
    return (
      <div className="state-card execution-timeline-state" role="status">
        <h2>Loading execution</h2>
        <p>Receiving execution updates.</p>
      </div>
    )
  }

  if (model.panelState === 'empty') {
    return (
      <div className="state-card execution-timeline-state" role="status">
        <h2>No execution events yet</h2>
        <p>The execution timeline will appear when updates are available.</p>
      </div>
    )
  }

  if (model.panelState === 'error') {
    return (
      <div className="state-card state-card--error execution-timeline-state" role="alert">
        <h2>Unable to load execution</h2>
        <p>{model.panelMessage ?? 'Execution updates could not be loaded.'}</p>
        {onRetry ? <button className="button button--secondary" onClick={onRetry} type="button">Retry</button> : null}
      </div>
    )
  }

  if (model.panelState === 'disabled') {
    return (
      <div className="state-card execution-timeline-state execution-timeline-state--disabled" role="status">
        <h2>Execution updates disabled</h2>
        <p>{model.panelMessage ?? 'Live execution updates are currently disabled.'}</p>
      </div>
    )
  }

  return null
}

function TimelineContent({ model }: { model: ExecutionTimelineViewModel }) {
  const headingId = useId()
  const paymentHeadingId = useId()

  return (
    <section aria-labelledby={headingId} className="execution-timeline">
      <div className="execution-timeline__header">
        <div>
          <p className="card-kicker">Execution</p>
          <h2 id={headingId}>{model.title}</h2>
        </div>
        <span className={statusClassName(model.executionStatus.value, model.executionStatus.tone)}>
          {model.executionStatus.label}
        </span>
      </div>

      <p className="execution-timeline__connection" role="status">
        <span aria-hidden="true" className={`execution-timeline__connection-dot execution-timeline__connection-dot--${model.connection.value}`} />
        {model.connection.label}
        {model.eventCount > 0 ? <span> · {model.eventCount} {model.eventCount === 1 ? 'event' : 'events'}</span> : null}
      </p>

      {model.errorLabel ? (
        <p className="execution-timeline__error" role="alert">{model.errorLabel}</p>
      ) : null}

      {model.costLabel ? (
        <dl aria-label="Execution cost" className="execution-timeline__summary">
          <div><dt>Cost</dt><dd>{model.costLabel}</dd></div>
        </dl>
      ) : null}

      {model.steps.length > 0 ? (
        <ol aria-label="Execution steps" className="execution-timeline__steps">
          {model.steps.map((step) => (
            <li
              aria-current={step.status === 'running' ? 'step' : undefined}
              aria-label={`${step.label}: ${step.statusLabel}`}
              className={`execution-timeline__step execution-timeline__step--${step.status}`}
              key={step.id}
            >
              <span aria-hidden="true" className="execution-timeline__marker" />
              <div className="execution-timeline__step-body">
                <div className="execution-timeline__step-heading">
                  <h3>{step.label}</h3>
                  <span className={statusClassName(step.status, step.statusTone)}>{step.statusLabel}</span>
                </div>
                {step.description ? <p>{step.description}</p> : null}
                {step.costLabel ? <p className="execution-timeline__detail"><strong>Cost:</strong> {step.costLabel}</p> : null}
                {step.errorLabel ? <p className="execution-timeline__error" role="alert">{step.errorLabel}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="execution-timeline__no-steps">No execution steps have been reported.</p>
      )}

      {model.payment ? (
        <section aria-labelledby={paymentHeadingId} className="execution-timeline__payment">
          <h3 id={paymentHeadingId}>Payment</h3>
          <dl>
            <div>
              <dt>Status</dt>
              <dd><span className={statusClassName(model.payment.status, model.payment.statusTone)}>{model.payment.statusLabel}</span></dd>
            </div>
            {model.payment.amountLabel ? <div><dt>Amount</dt><dd>{model.payment.amountLabel}</dd></div> : null}
            {model.payment.reference ? <div><dt>Reference</dt><dd className="execution-timeline__reference">{model.payment.reference}</dd></div> : null}
          </dl>
          {model.payment.errorLabel ? <p className="execution-timeline__error" role="alert">{model.payment.errorLabel}</p> : null}
        </section>
      ) : null}
    </section>
  )
}

export function ExecutionTimeline({
  onRetry,
  timeline,
  viewModel,
  ...options
}: ExecutionTimelineProps) {
  const model = viewModel ?? createExecutionTimelineViewModel(
    timeline ?? createExecutionTimelineState(),
    options,
  )

  return (
    <>
      <PanelState model={model} onRetry={onRetry} />
      {model.panelState === 'ready' ? <TimelineContent model={model} /> : null}
    </>
  )
}

export interface ExecutionTimelinePanelProps extends Omit<ExecutionTimelineProps, 'viewModel'> {
  state?: ExecutionPanelState
}

export function ExecutionTimelinePanel({ state, ...props }: ExecutionTimelinePanelProps) {
  return <ExecutionTimeline {...props} panelState={state ?? props.panelState} />
}
