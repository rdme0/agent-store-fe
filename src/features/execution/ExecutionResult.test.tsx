import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ExecutionResult } from './ExecutionResult'

afterEach(() => cleanup())

describe('ExecutionResult', () => {
  it('renders text without interpreting an arbitrary object', () => {
    const { container } = render(<ExecutionResult output={'첫 줄\n둘째 줄'} responseFormat="TEXT" />)
    expect(screen.getByText(/첫 줄/)).toBeInTheDocument()
    expect(container.querySelector('.execution-result__json')).not.toBeInTheDocument()
  })

  it('renders markdown and removes unsafe HTML and links', () => {
    const { container } = render(
      <ExecutionResult
        output={'# 제목\n\n<script>alert(1)</script>\n\n[위험](javascript:alert(1))'}
        responseFormat="MARKDOWN"
      />,
    )
    expect(screen.getByRole('heading', { name: '제목' })).toBeInTheDocument()
    expect(container.querySelector('script')).not.toBeInTheDocument()
    expect(container.querySelector('a')).not.toHaveAttribute('href')
  })

  it('renders the declared structured contract as readable sections', () => {
    render(
      <ExecutionResult
        output={{ title: '투자 요약', summary: '균형 전략', sections: [{ label: '점수', value: 0.82 }, { label: '추천', value: '분산' }] }}
        responseFormat="STRUCTURED"
      />,
    )
    expect(screen.getByRole('heading', { name: '투자 요약' })).toBeInTheDocument()
    expect(screen.getByText('균형 전략')).toBeInTheDocument()
    expect(screen.getByText('분산')).toBeInTheDocument()
  })

  it('falls back to generic JSON for missing or unknown contracts', () => {
    const { container } = render(<ExecutionResult output={{ arbitrary: { nested: true } }} />)
    expect(container.querySelector('.execution-result__json')).toHaveTextContent('arbitrary')
    expect(container.querySelector('.execution-result__json')).toHaveTextContent('nested')
  })
})
