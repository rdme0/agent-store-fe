import { PagePlaceholder } from './PagePlaceholder'

export function HomePage() {
  return (
    <PagePlaceholder
      eyebrow="Overview"
      title="A calmer way to run agents."
      description="Your agent workspace is ready. Connect the API when the contract is available, then manage agents, executions, and payments from one place."
    >
      <div className="welcome-card">
        <div>
          <p className="card-kicker">Workspace foundation</p>
          <h2>Build your agent catalog</h2>
          <p>
            This shell is intentionally data-free while the API contract is being
            finalized.
          </p>
        </div>
        <span className="welcome-card__icon" aria-hidden="true">
          ↗
        </span>
      </div>
    </PagePlaceholder>
  )
}
