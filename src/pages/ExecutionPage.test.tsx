/// <reference types="node" />
import { createServer, type Server } from 'node:http'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ExecutionDto } from '../entities/execution/api'
import { agentStoreClient } from '../shared/api/generatedClient'
import { storeDemoAccess } from '../shared/auth/demoAccess'
import { DisplayModeProvider } from '../app/DisplayModeContext'
import { ExecutionPage } from './ExecutionPage'

let server: Server
let snapshot: ExecutionDto
let firstSnapshot: ExecutionDto | undefined
let responseStatus = 200
let firstExecutionDelay: Promise<void> | undefined
let firstExecutionRequested: (() => void) | undefined
const clients: QueryClient[] = []
const viewportDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia')

// Explicit fixed viewport fake; viewport changes are covered by browser E2E.
function setViewport(narrow: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: () => ({
      matches: narrow,
      media: '(max-width: 700px)',
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() { return true },
    }),
  })
}

function renderPage(withLocationSnapshot = true, displayMode: 'easy' | 'developer' = 'developer', executionId = 'execution-id') {
  window.localStorage.setItem('agentstore.display-mode', displayMode)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(queryClient)
  const router = createMemoryRouter([
    { path: '/runs/:id', element: <ExecutionPage /> },
    { path: '/agents', element: <p>Marketplace</p> },
  ], {
    initialEntries: [{
      pathname: `/runs/${executionId}`,
      state: withLocationSnapshot ? {
        quoteSnapshot: {
          version: {
            id: 'root-version', agentId: 'root-agent', agentCode: 'investment', semver: '1.0.0',
            endpoint: 'http://localhost:8090/investment', priceAtomic: '1000000', network: 'eip155:84532',
            asset: 'USDC', payTo: '0x0000000000000000000000000000000000000001',
          },
          dependencies: [],
        },
      } : undefined,
    }],
  })
  render(<QueryClientProvider client={queryClient}><DisplayModeProvider><RouterProvider router={router} /></DisplayModeProvider></QueryClientProvider>)
  return { router }
}

beforeEach(async () => {
  window.localStorage.clear()
  storeDemoAccess({ accessToken: 'execution-http-fixture', expiresAt: new Date(Date.now() + 21600000).toISOString() })
  responseStatus = 200
  firstSnapshot = undefined
  firstExecutionDelay = undefined
  firstExecutionRequested = undefined
  setViewport(false)
  server = createServer(async (request, response) => {
    if (request.url?.endsWith('/events')) {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' })
      response.end('id: 1\nevent: EXECUTION_COMPLETED\ndata: {"terminal":true}\n\n')
      return
    }
    if (request.url?.startsWith('/api/executions/first')) {
      firstExecutionRequested?.()
      await firstExecutionDelay
    }
    const result = firstSnapshot ?? snapshot
    firstSnapshot = undefined
    response.writeHead(responseStatus, { 'Content-Type': 'application/json', 'X-Trace-Id': 'execution-fixture-trace' })
    response.end(JSON.stringify({ isSuccess: responseStatus === 200, message: responseStatus === 200 ? 'success' : '실행 조회 오류', errorCode: responseStatus === 200 ? null : 'COMMON_503_001', result: responseStatus === 200 ? result : null }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  agentStoreClient.setConfig({ baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}`, headers: { Accept: 'application/json' } })
})

afterEach(async () => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  window.localStorage.clear()
  agentStoreClient.setConfig({ baseUrl: 'http://localhost:8080', headers: { Accept: 'application/json' } })
  if (viewportDescriptor) Object.defineProperty(window, 'matchMedia', viewportDescriptor)
  else Reflect.deleteProperty(window, 'matchMedia')
})

describe('ExecutionPage', () => {
  it('renders step state, exact costs, question, and final output from GET details', async () => {
    snapshot = {
      id: 'execution-id', quoteId: 'quote-id', status: 'COMPLETED', maxBudgetAtomic: '3000000',
      reservedCostAtomic: '0', actualCostAtomic: '1000000', question: '시장 위험은?',
      steps: [{
        id: 'root-step', agentVersionId: 'root-version', status: 'COMPLETED', costAtomic: '1000000',
        output: { answer: '분산 투자가 필요합니다.' }, payments: [{
          id: 'payment-id', status: 'SETTLED', amountAtomic: '1000000',
          transactionHash: `0x${'a'.repeat(64)}`, paymentIdentifier: 'receipt-id',
        }], createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
      }], createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
    }
    renderPage()

    expect(await screen.findByRole('heading', { name: '실행 상세' })).toBeInTheDocument()
    expect(screen.getByText('시장 위험은?')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: '분석 단계: 확인 완료' })).toBeInTheDocument()
    expect(screen.getByText(/분산 투자가 필요합니다/)).toBeInTheDocument()
    expect(screen.getAllByText('1 USDC').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3 USDC').length).toBeGreaterThanOrEqual(1)
  })

  it('renders an API error with a retry action', async () => {
    responseStatus = 503
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('실행 조회 오류')
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled()
  })

  it('selects the renderer from the execution step response format', async () => {
    snapshot = {
      id: 'execution-id', quoteId: 'quote-id', status: 'COMPLETED', maxBudgetAtomic: '1000000',
      reservedCostAtomic: '0', actualCostAtomic: '1000000',
      steps: [{
        id: 'root-step', agentVersionId: 'root-version', status: 'COMPLETED', costAtomic: '1000000', responseFormat: 'STRUCTURED',
        output: { title: '결과 요약', sections: [{ label: '상태', value: '완료' }] }, payments: [],
        createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
      }], createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
    }
    renderPage()

    expect(await screen.findByRole('heading', { name: '결과 요약' })).toBeInTheDocument()
    expect(screen.getAllByText('완료').length).toBeGreaterThan(0)
  })

  it('adds dependency steps and edges after the terminal event refreshes execution details', async () => {
    const baseExecution = {
      id: 'execution-id', quoteId: 'quote-id', maxBudgetAtomic: '2000', reservedCostAtomic: '0',
      question: '삼성전자 투자 분석해줘', createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
    }
    const rootStep = {
      id: 'root-step', agentVersionId: 'root-version', costAtomic: '1000', payments: [],
      createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
    }
    firstSnapshot = {
        ...baseExecution,
        status: 'RUNNING',
        actualCostAtomic: '1000',
        steps: [{ ...rootStep, status: 'RUNNING' }],
      }
      snapshot = {
        ...baseExecution,
        status: 'COMPLETED',
        actualCostAtomic: '2000',
        steps: [
          { ...rootStep, status: 'COMPLETED', output: { recommendation: '분석 완료' } },
          {
            id: 'financial-step', parentStepId: 'root-step', agentVersionId: 'financial-version',
            status: 'COMPLETED', costAtomic: '1000', output: { revenueGrowth: 12 }, payments: [],
            createdAt: '2026-08-17T00:00:01Z', updatedAt: '2026-08-17T00:00:02Z',
          },
        ],
      }
    renderPage()

    fireEvent.click(await screen.findByText('거래 상세 보기'))
    expect(await screen.findByText('노드 2개 · 연결 1개', {}, { timeout: 5_000 })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '분석 단계 · COMPLETED 의존성' })).toHaveTextContent('runtime call')
  })

  it('restores the quoted graph and provider selection proof from the execution response', async () => {
    snapshot = {
      id: 'execution-id', quoteId: 'quote-id', status: 'COMPLETED', maxBudgetAtomic: '2000',
      reservedCostAtomic: '0', actualCostAtomic: '1000', steps: [],
      quoteSnapshot: {
        version: {
          id: 'root-version', agentId: 'root-agent', agentCode: 'investment', agentName: '투자 분석', semver: '1.0.0',
          agentDescription: '시장·뉴스·위험 분석을 모아 최종 답변을 만들어요.',
          endpoint: 'http://localhost:8090/investment', priceAtomic: '1000', network: 'eip155:84532',
          asset: 'USDC', payTo: '0x0000000000000000000000000000000000000001', responseFormat: 'MARKDOWN',
        },
        dependencies: [{
          dependencyId: 'dependency-id', versionConstraint: '*', required: true,
          maxPriceAtomic: '1000', maxCalls: 1,
          selection: {
            strategy: 'lowest_price', providerScope: 'marketplace', functionContractId: 'function-contract-id', functionCode: 'news-analysis',
            functionContractVersion: '1.0.0', selectedVersionId: 'news-version', selectedReason: 'selected_by_lowest_price',
            candidates: [{ agentId: 'news-agent', agentCode: 'news-fast', versionId: 'news-version', semver: '1.0.0', priceAtomic: '500', status: 'selected' }],
          },
          resolved: {
            version: {
              id: 'news-version', agentId: 'news-agent', agentCode: 'news-fast', agentName: '빠른 뉴스', semver: '1.0.0',
              agentDescription: '시장과 관련된 최신 기사를 살펴봐요.',
              endpoint: 'http://localhost:8091/news-fast', priceAtomic: '500', network: 'eip155:84532',
              asset: 'USDC', payTo: '0x0000000000000000000000000000000000000002', responseFormat: 'JSON',
            },
            dependencies: [],
          },
        }],
      },
      createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:02Z',
    }

    renderPage(false)

    fireEvent.click(await screen.findByText('거래 상세 보기'))
    expect(await screen.findByRole('heading', { name: 'Quote에 고정된 거래 그래프' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '공급자 선택 증명' })).toBeInTheDocument()
    expect(screen.getByText('selected_by_lowest_price')).toBeInTheDocument()
    expect(screen.getAllByText('빠른 뉴스').length).toBeGreaterThan(0)
    expect(screen.getByText('시장과 관련된 최신 기사를 살펴봐요.')).toBeInTheDocument()
    expect(screen.getByText('이번 답변에는 사용되지 않았어요')).toBeInTheDocument()
  })

  it('does not expose provider selection wallet or transaction proof in easy mode', async () => {
    const payTo = '0x0000000000000000000000000000000000000002'
    const transactionHash = `0x${'b'.repeat(64)}`
    snapshot = {
      id: 'execution-id', quoteId: 'quote-id', status: 'COMPLETED', maxBudgetAtomic: '1000',
      reservedCostAtomic: '0', actualCostAtomic: '1000', question: '쉽게 설명해줘',
      steps: [{
        id: 'root-step', agentVersionId: 'root-version', status: 'COMPLETED', costAtomic: '1000',
        responseFormat: 'MARKDOWN', output: '# 쉬운 답변', payments: [{
          id: 'payment-id', status: 'SETTLED', amountAtomic: '1000', transactionHash,
        }], createdAt: '', updatedAt: '',
      }],
      quoteSnapshot: {
        version: {
          id: 'root-version', agentId: 'root-agent', agentCode: 'investment', semver: '1.0.0',
          endpoint: 'http://localhost:8090/investment', priceAtomic: '1000', network: 'eip155:84532',
          asset: 'USDC', payTo, responseFormat: 'MARKDOWN',
        },
        dependencies: [],
      },
      createdAt: '', updatedAt: '',
    }

    renderPage(false, 'easy')

    expect(await screen.findByRole('heading', { name: '답변을 정리했어요' })).toBeInTheDocument()
    expect(screen.queryByText('공급자 선택 증명')).not.toBeInTheDocument()
    expect(screen.queryByText(payTo)).not.toBeInTheDocument()
    expect(screen.queryByText(transactionHash)).not.toBeInTheDocument()
  })

  it('separates an unknown payment outcome from ordinary failure in easy mode', async () => {
    snapshot = {
      id: 'execution-id', quoteId: 'quote-id', status: 'FAILED', maxBudgetAtomic: '1000',
      reservedCostAtomic: '1000', actualCostAtomic: '1000', question: '분석해줘',
      steps: [{
        id: 'root-step', agentVersionId: 'root-version', status: 'FAILED', costAtomic: '1000',
        responseFormat: 'MARKDOWN', payments: [{
          id: 'payment-id', status: 'RECONCILIATION_REQUIRED', amountAtomic: '1000',
        }], createdAt: '', updatedAt: '',
      }],
      quoteSnapshot: {
        version: {
          id: 'root-version', agentId: 'root-agent', agentCode: 'investment', agentName: '투자 분석',
          agentDescription: '여러 분석을 모아 답변을 만들어요.', semver: '1.0.0',
          endpoint: 'http://localhost:8090/investment', priceAtomic: '1000', network: 'eip155:84532',
          asset: 'USDC', payTo: '0x0000000000000000000000000000000000000001', responseFormat: 'MARKDOWN',
        },
        dependencies: [],
      },
      createdAt: '', updatedAt: '',
    }

    renderPage(false, 'easy')

    expect(await screen.findByRole('heading', { name: '결제를 확인하고 있어요' })).toBeInTheDocument()
    expect(screen.getByText(/결제 확인 중이라 결과를 확정하지 못했어요/)).toBeInTheDocument()
    expect(screen.getByText('다시 결제하지 마세요.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '분석을 마치지 못했어요.' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('분석 단계 보기'))
    expect(screen.getByRole('article', { name: '투자 분석: 결제 확인 중' })).toBeInTheDocument()
  })

  it('does not render technical graphs on a narrow viewport', async () => {
    setViewport(true)
    snapshot = {
      id: 'execution-id', quoteId: 'quote-id', status: 'RUNNING', maxBudgetAtomic: '1000',
      reservedCostAtomic: '1000', actualCostAtomic: '0', steps: [],
      quoteSnapshot: {
        version: {
          id: 'root-version', agentId: 'root-agent', agentCode: 'investment', semver: '1.0.0',
          endpoint: 'http://localhost:8090/investment', priceAtomic: '1000', network: 'eip155:84532',
          asset: 'USDC', payTo: '0x0000000000000000000000000000000000000001', responseFormat: 'MARKDOWN',
        },
        dependencies: [],
      },
      createdAt: '', updatedAt: '',
    }

    renderPage(false, 'developer')

    expect(await screen.findByRole('heading', { name: '질문이 답변이 되기까지' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Quote에 고정된 거래 그래프' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '실시간 의존성 그래프' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('거래 상세 보기'))
    expect(await screen.findByText(/모바일에서는 거래 그래프 대신/)).toBeInTheDocument()
  })

  it('keeps the current execution visible when an aborted previous route response arrives late', async () => {
    let releaseFirst: (() => void) | undefined
    let firstStarted: (() => void) | undefined
    firstExecutionDelay = new Promise<void>((resolve) => { releaseFirst = resolve })
    const firstRequest = new Promise<void>((resolve) => { firstStarted = resolve })
    firstExecutionRequested = firstStarted
    snapshot = {
      id: 'first', quoteId: 'quote-id', status: 'RUNNING', maxBudgetAtomic: '1000', reservedCostAtomic: '0', actualCostAtomic: '0', question: '이전 실행',
      steps: [], createdAt: '', updatedAt: '',
    }
    const { router } = renderPage(false, 'easy', 'first')
    await firstRequest
    snapshot = {
      id: 'second', quoteId: 'quote-id', status: 'COMPLETED', maxBudgetAtomic: '1000', reservedCostAtomic: '0', actualCostAtomic: '1000', question: '현재 실행',
      steps: [{ id: 'root-step', agentVersionId: 'root-version', status: 'COMPLETED', costAtomic: '1000', output: { answer: '현재 결과' }, payments: [], createdAt: '', updatedAt: '' }], createdAt: '', updatedAt: '',
    }
    await act(async () => { await router.navigate('/runs/second') })
    expect(await screen.findByText('현재 실행')).toBeInTheDocument()
    releaseFirst?.()
    await waitFor(() => expect(screen.queryByText('이전 실행')).not.toBeInTheDocument())
  })

  it('explains a completed execution with missing output and retains it when refresh fails', async () => {
    snapshot = {
      id: 'execution-id', quoteId: 'quote-id', status: 'COMPLETED', maxBudgetAtomic: '1000', reservedCostAtomic: '0', actualCostAtomic: '1000', question: '결과가 없는 실행',
      steps: [{ id: 'root-step', agentVersionId: 'root-version', status: 'COMPLETED', costAtomic: '1000', output: null, payments: [], createdAt: '', updatedAt: '' }], createdAt: '', updatedAt: '',
    }
    renderPage(false, 'easy')
    expect(await screen.findByRole('heading', { name: '완료된 실행에 답변이 없어요.' })).toBeInTheDocument()
    responseStatus = 503
    fireEvent.click(screen.getByRole('button', { name: '상태 다시 확인' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('마지막으로 확인한 정보를 표시하고 있습니다.')
    expect(screen.getByText('결과가 없는 실행')).toBeInTheDocument()
  })
})
