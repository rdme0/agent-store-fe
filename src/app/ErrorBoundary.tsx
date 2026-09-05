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
          <p className="section-label">AgentStore</p>
          <h1>화면을 표시할 수 없습니다</h1>
          <p>일시적인 문제가 발생했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.</p>
          <div className="error-page__actions">
            <button type="button" onClick={this.handleReload}>
              새로고침
            </button>
            <a href="/marketplace">Marketplace로 돌아가기</a>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
