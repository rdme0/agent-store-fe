import { spawn } from 'node:child_process'
import { chromium } from '@playwright/test'

const apiUrl = requiredEnvironment('SPRING_BROWSER_API_URL')
const agentCode = requiredEnvironment('SPRING_BROWSER_AGENT_CODE')
const vitePort = 4187
const webUrl = `http://localhost:${vitePort}`
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
let vite
let browser

try {
  vite = spawn(npm, ['run', 'dev', '--', '--host', 'localhost', '--port', String(vitePort), '--strictPort'], {
    env: { ...process.env, VITE_API_BASE_URL: apiUrl },
    shell: true,
    stdio: 'inherit',
  })
  await waitForVite()

  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error))

  await page.goto(`${webUrl}/marketplace`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Spring Browser Agent' }).waitFor()
  await page.getByRole('link', { name: 'Spring Browser Agent 상세 및 실행' }).click()
  await page.getByRole('textbox', { name: '질문' }).fill('실제 Spring과 PostgreSQL을 거친 브라우저 실행')
  await page.getByRole('button', { name: '비용 알아보기', exact: true }).click()
  await page.getByRole('checkbox').waitFor()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /분석 시작/ }).click()
  await page.waitForURL(/\/runs\/[0-9a-f-]{36}$/i)
  await page.getByRole('heading', { name: '답변을 정리했어요' }).waitFor({ timeout: 60_000 })
  await page.getByText('실제 Spring 브라우저 결과').waitFor({ timeout: 60_000 })
  if (pageErrors.length > 0) throw pageErrors[0]
} finally {
  await browser?.close()
  await stop(vite)
}

function requiredEnvironment(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for the Spring browser gate`)
  return value
}

async function waitForVite() {
  let lastError
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (vite?.exitCode !== null) throw new Error(`Vite exited before becoming ready: ${vite?.exitCode}`)
    try {
      const response = await fetch(webUrl)
      if (response.ok) return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Vite did not become ready: ${String(lastError)}`)
}

async function stop(process) {
  if (!process || process.exitCode !== null) return
  if (globalThis.process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(process.pid), '/t', '/f'], { stdio: 'ignore' })
      killer.once('exit', resolve)
      killer.once('error', resolve)
    })
    return
  }
  process.kill('SIGTERM')
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 10_000)
    process.once('exit', () => { clearTimeout(timer); resolve(undefined) })
  })
  if (process.exitCode === null) process.kill('SIGKILL')
}
