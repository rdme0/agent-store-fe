import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDisplayMode } from '../app/DisplayModeContext'
import { requestDemoAccess } from '../entities/developer/demoAccessApi'
import { storeDemoAccess, currentDemoAccess } from '../shared/auth/demoAccess'

const proof = [
  ['1', 'Function Contract', 'Agent가 필요한 역할과 입출력 계약을 먼저 확인합니다.'],
  ['2', 'Quote 고정', '공급자, Version, 최대 비용을 실행 전에 하나의 계약으로 고정합니다.'],
  ['3', 'x402 정산', 'Base Sepolia USDC로 Agent 간 결제를 실행하고 거래 결과를 남깁니다.'],
]

export function LandingPage() {
  const navigate = useNavigate()
  const { setDisplayMode } = useDisplayMode()
  const [params] = useSearchParams()
  const developerAccess = params.get('developer') === '1'
  const [pending, setPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const mountedRef = useRef(true)
  const pendingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | undefined>(undefined)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [])

  async function startDemo() {
    if (pendingRef.current) return
    const destination = developerAccess ? '/developer/revenue' : '/marketplace'
    const existing = currentDemoAccess()
    if (existing) {
      setDisplayMode('developer')
      navigate(destination, { replace: true })
      return
    }

    pendingRef.current = true
    setPending(true)
    setErrorMessage(undefined)
    const controller = new AbortController()
    abortControllerRef.current?.abort()
    abortControllerRef.current = controller
    try {
      const access = await requestDemoAccess(controller.signal)
      if (!mountedRef.current || controller.signal.aborted) return
      storeDemoAccess(access)
      setDisplayMode('developer')
      navigate(destination, { replace: true })
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted) return
      setErrorMessage(error instanceof Error ? error.message : '데모를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      pendingRef.current = false
      if (mountedRef.current && !controller.signal.aborted) setPending(false)
    }
  }

  return <section className="landing-page" aria-labelledby="landing-title">
    <div className="landing-page__grid" aria-hidden="true" />
    <div className="landing-page__hero">
      <p className="landing-page__eyebrow">AGENT-TO-AGENT COMMERCE</p>
      <h1 id="landing-title">AI 에이전트가 서로의 서비스를 고르고, 비용을 계산하고, 결제까지 한다면—<span>그건 진정한 자동화일까요?</span></h1>
      <p className="landing-page__lead">AgentStore는 사람의 카드·API key 흐름 대신, 계약·예산·x402 결제를 이해하는 AI Agent 간 거래를 만듭니다.</p>
      <div className="landing-page__actions"><button aria-busy={pending} className="button landing-page__cta" disabled={pending} onClick={() => void startDemo()} type="button">{pending ? '데모 입장 중…' : '데모 시작'} {!pending ? <ArrowRight aria-hidden="true" size={18} /> : null}</button></div>
      <p aria-live="polite" className="landing-page__notice">{errorMessage ?? '클릭 한 번으로 AgentStore 데모를 시작합니다.'}</p>
    </div>
    <section aria-labelledby="proof-title" className="landing-page__proof"><div><p className="landing-page__eyebrow">THE TRANSACTION PATH</p><h2 id="proof-title">자동화는 실행만이 아니라, 승인 가능한 비용과 정산까지 포함합니다.</h2></div><ol>{proof.map(([step, title, description]) => <li key={step}><span>{step}</span><div><h3>{title}</h3><p>{description}</p></div><CheckCircle2 aria-hidden="true" size={20} /></li>)}</ol></section>
  </section>
}
