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
        <h2>실행 정보를 불러오는 중</h2>
        <p>Agent 실행 상태를 확인하고 있습니다.</p>
      </div>
    )
  }

  if (model.panelState === 'empty') {
    return (
      <div className="state-card execution-timeline-state" role="status">
        <h2>아직 실행 이벤트가 없습니다.</h2>
        <p>업데이트가 도착하면 실행 흐름이 여기에 표시됩니다.</p>
      </div>
    )
  }

  if (model.panelState === 'error') {
    return (
      <div className="state-card state-card--error execution-timeline-state" role="alert">
        <h2>실행 정보를 불러오지 못했습니다.</h2>
        <p>{model.panelMessage ?? '실행 업데이트를 불러오지 못했습니다.'}</p>
        {onRetry ? <button className="button button--secondary" onClick={onRetry} type="button">다시 시도</button> : null}
      </div>
    )
  }

  if (model.panelState === 'disabled') {
    return (
      <div className="state-card execution-timeline-state execution-timeline-state--disabled" role="status">
        <h2>실행 업데이트가 비활성화되었습니다.</h2>
        <p>{model.panelMessage ?? '현재 실시간 실행 업데이트를 사용할 수 없습니다.'}</p>
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
          <p className="card-kicker">실행 흐름</p>
          <h2 id={headingId}>{model.title}</h2>
        </div>
        <span className={statusClassName(model.executionStatus.value, model.executionStatus.tone)}>
          {model.executionStatus.label}
        </span>
      </div>

      <p className="execution-timeline__connection" role="status">
        <span aria-hidden="true" className={`execution-timeline__connection-dot execution-timeline__connection-dot--${model.connection.value}`} />
        {model.connection.label}
        {model.eventCount > 0 ? <span> · 이벤트 {model.eventCount}개</span> : null}
      </p>

      {model.errorLabel ? (
        <p className="execution-timeline__error" role="alert">{model.errorLabel}</p>
      ) : null}

      {model.costLabel ? (
        <dl aria-label="실행 비용" className="execution-timeline__summary">
          <div><dt>비용</dt><dd>{model.costLabel}</dd></div>
        </dl>
      ) : null}

      {model.steps.length > 0 ? (
        <ol aria-label="Execution steps" className="execution-timeline__steps">
          {model.steps.map((step) => (
            <li
              aria-current={step.status.toLowerCase() === 'running' ? 'step' : undefined}
              aria-label={`${step.label}: ${step.statusLabel}`}
              className={`execution-timeline__step execution-timeline__step--${step.status.toLowerCase().replaceAll('_', '-')}`}
              key={step.id}
            >
              <span aria-hidden="true" className="execution-timeline__marker" />
              <div className="execution-timeline__step-body">
                <div className="execution-timeline__step-heading">
                  <h3>{step.label}</h3>
                  <span className={statusClassName(step.status, step.statusTone)}>{step.statusLabel}</span>
                </div>
                {step.description ? <p>{step.description}</p> : null}
                {step.costLabel ? <p className="execution-timeline__detail"><strong>비용:</strong> {step.costLabel}</p> : null}
                {step.errorLabel ? <p className="execution-timeline__error" role="alert">{step.errorLabel}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="execution-timeline__no-steps">아직 보고된 실행 단계가 없습니다.</p>
      )}

      {model.payment ? (
        <section aria-labelledby={paymentHeadingId} className="execution-timeline__payment">
          <h3 id={paymentHeadingId}>결제</h3>
          <dl>
            <div>
              <dt>상태</dt>
              <dd><span className={statusClassName(model.payment.status, model.payment.statusTone)}>{model.payment.statusLabel}</span></dd>
            </div>
            {model.payment.amountLabel ? <div><dt>금액</dt><dd>{model.payment.amountLabel}</dd></div> : null}
            {model.payment.modeLabel ? <div><dt>방식</dt><dd>{model.payment.modeLabel}</dd></div> : null}
            {model.payment.reference ? <div><dt>거래 hash</dt><dd className="execution-timeline__reference">{model.payment.transactionExplorerUrl ? <a href={model.payment.transactionExplorerUrl} rel="noreferrer" target="_blank">{model.payment.reference} (Base Sepolia)</a> : model.payment.reference}</dd></div> : null}
            {model.payment.paymentIdentifier ? <div><dt>결제 식별자</dt><dd className="execution-timeline__reference">{model.payment.paymentIdentifier}</dd></div> : null}
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
