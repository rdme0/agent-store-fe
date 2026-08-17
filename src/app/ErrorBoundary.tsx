import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Keep logging local until an observability provider is selected.
    console.error('Unhandled application error', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <main className="error-page" role="alert">
          <p className="eyebrow">AgentStore</p>
          <h1>Something went wrong</h1>
          <p>
            The workspace could not be rendered. Reload the page to try again.
          </p>
          <div className="error-page__actions">
            <button type="button" onClick={this.handleReload}>
              Reload workspace
            </button>
            <a href="/">Return home</a>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
