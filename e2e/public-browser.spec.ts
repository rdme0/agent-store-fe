import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

const fixtureUrl = 'http://127.0.0.1:18080'
test.beforeEach(async ({ context, request }, testInfo) => {
  const id = randomUUID()
  testInfo.annotations.push({ type: 'fixture-id', description: id })
  await request.post(`${fixtureUrl}/__scenario/${id}`, { data: { mode: 'success' } })
  await context.setExtraHTTPHeaders({ 'x-fixture-id': id })
})
function fixtureId() { return test.info().annotations.find((item) => item.type === 'fixture-id')!.description! }
async function start(page: Page) {
  await page.goto('/')
  await page.locator('.landing-page').getByRole('button', { name: /데모 시작/ }).click()
  await expect(page).toHaveURL(/\/marketplace$/)
}
async function developerMode(page: Page) {
  if ((page.viewportSize()?.width ?? 0) <= 900) await page.getByRole('button', { name: '메뉴 열기' }).click()
  await page.getByRole('button', { name: '개발자 모드', exact: true }).click()
}
async function cost(page: Page) {
  await page.goto('/agents/browser-demo-agent')
  await page.getByRole('textbox').fill('10만원대 헤드셋 추천해줘')
  await page.getByRole('button', { name: '비용 알아보기', exact: true }).click()
  await expect(page.getByRole('checkbox')).toBeVisible()
}
async function execute(page: Page) {
  await cost(page)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /분석 시작/ }).click()
  await expect(page).toHaveURL(/\/runs\/browser-execution-1$/)
}

test('public Marketplace and detail browsing do not issue access', async ({ page, request }) => {
  await page.goto('/marketplace')
  await expect(page).toHaveURL(/\/marketplace$/)
  await expect(page.getByRole('heading', { name: 'Browser Demo Agent' })).toBeVisible()
  await page.goto('/agents/browser-demo-agent')
  await expect(page.getByRole('heading', { name: 'Browser Demo Agent' })).toBeVisible()
  const { result } = await (await request.get(`${fixtureUrl}/__scenario/${fixtureId()}`)).json()
  expect(result.requests.some((item: { path: string }) => item.path === '/api/demo/access')).toBe(false)
  expect(result.requests.filter((item: { path: string }) => item.path.startsWith('/api/agents')).every((item: { authorization: string | null }) => item.authorization === null)).toBe(true)
})

test('starts easy and preserves the chosen developer mode', async ({ page }) => {
  await start(page)
  await expect(page.locator('.app-shell--developer')).toHaveCount(0)
  const mobile = (page.viewportSize()?.width ?? 0) <= 900
  if (mobile) await page.getByRole('button', { name: '메뉴 열기' }).click()
  const navigation = mobile ? page.getByRole('dialog', { name: '모바일 주요 탐색' }) : page
  await expect(navigation.getByRole('button', { name: '데모 종료' })).toBeVisible()
  await expect(navigation.getByRole('status', { name: '데모 이용 기간' })).toBeVisible()
  await navigation.getByRole('button', { name: '개발자 모드', exact: true }).click()
  await expect(page.locator('.app-shell--developer')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('.app-shell--developer')).toHaveCount(1)
})

test('returns to private destination after access', async ({ page }) => {
  await page.goto('/developer/revenue')
  await expect(page.locator('.landing-page')).toBeVisible()
  await page.locator('.landing-page').getByRole('button', { name: /데모 시작/ }).click()
  await expect(page).toHaveURL(/\/developer\/revenue$/)
  await expect(page.getByRole('heading', { name: '내 Agent 관리' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('agentstore.demo-access'))).toContain('fixture-browser-access')
})

test('distinguishes empty catalog, no search matches and transport failure', async ({ page, request }) => {
  await request.post(`${fixtureUrl}/__scenario/${fixtureId()}`, { data: { mode: 'empty' } })
  await page.goto('/marketplace')
  await expect(page.getByText('공개 조건을 충족한 Agent가 없습니다', { exact: false })).toBeVisible()
  await request.post(`${fixtureUrl}/__scenario/${fixtureId()}`, { data: { mode: 'success' } })
  await page.reload()
  await page.getByLabel('Agent 검색').fill('none')
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await expect(page.getByRole('heading', { name: '검색 결과가 없습니다.' })).toBeVisible()
  await page.getByLabel('Agent 검색').fill('error')
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Marketplace를 잠시 불러올 수 없습니다.')
})

test('question to approved execution reaches result through HTTP and SSE once', async ({ page, request }) => {
  await execute(page)
  await expect(page.getByRole('heading', { name: '브라우저 분석 결과' })).toBeVisible()
  const { result } = await (await request.get(`${fixtureUrl}/__scenario/${fixtureId()}`)).json()
  expect(result.requests.filter((item: { path: string }) => item.path === '/api/demo/access')).toHaveLength(1)
  const executions = result.requests.filter((item: { path: string; method: string }) => item.path === '/api/executions' && item.method === 'POST')
  expect(executions).toHaveLength(1)
  expect(JSON.parse(executions[0].body)).toMatchObject({ question: '10만원대 헤드셋 추천해줘', maxBudgetAtomic: '10000', quoteId: 'quote-1' })
  expect(executions[0].authorization).toBe('Bearer fixture-browser-access')
  expect(result.requests.some((item: { path: string }) => item.path.endsWith('/events'))).toBe(true)
  await page.screenshot({ path: test.info().outputPath('completed.png'), fullPage: true })
})

test('expired quote preserves question and requires fresh approval', async ({ page, request }) => {
  await request.post(`${fixtureUrl}/__scenario/${fixtureId()}`, { data: { mode: 'expired-quote' } })
  await cost(page)
  await expect(page.getByRole('checkbox')).toBeDisabled()
  await page.getByRole('button', { name: '비용 다시 확인', exact: true }).click()
  await expect(page.getByRole('checkbox')).toBeEnabled()
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await expect(page.getByRole('textbox')).toHaveValue('10만원대 헤드셋 추천해줘')
  const { result } = await (await request.get(`${fixtureUrl}/__scenario/${fixtureId()}`)).json()
  expect(result.execution).toBeNull()
})

test('unknown payment offers lookup and never creates another execution', async ({ page, request }) => {
  await request.post(`${fixtureUrl}/__scenario/${fixtureId()}`, { data: { mode: 'reconciliation' } })
  await execute(page)
  await expect(page.getByText(/다시 결제하지 마세요/).first()).toBeVisible()
  await expect(page.getByText(/다른 Agent로 다시/)).toHaveCount(0)
  await page.getByRole('button', { name: '상태 다시 확인' }).click()
  const { result } = await (await request.get(`${fixtureUrl}/__scenario/${fixtureId()}`)).json()
  expect(result.requests.filter((item: { path: string; method: string }) => item.path === '/api/executions' && item.method === 'POST')).toHaveLength(1)
  await page.screenshot({ path: test.info().outputPath('reconciliation.png'), fullPage: true })
})

test('partial failure displays successful child output separately', async ({ page, request }) => {
  await request.post(`${fixtureUrl}/__scenario/${fixtureId()}`, { data: { mode: 'partial' } })
  await execute(page)
  await expect(page.getByText('완료된 리뷰 분석 내용입니다.')).toBeVisible()
  await expect(page.getByRole('heading', { name: '브라우저 분석 결과' })).toHaveCount(0)
})

test('401 removes access and returns to entry without replaying mutation', async ({ page, request }) => {
  await start(page)
  await request.post(`${fixtureUrl}/__scenario/${fixtureId()}`, { data: { mode: 'unauthorized' } })
  await page.goto('/developer/revenue')
  await expect(page.locator('.landing-page')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('agentstore.demo-access'))).toBeNull()
})

test('keyboard entry remains usable at 130 percent', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { document.documentElement.style.zoom = '1.3' })
  await page.locator('.landing-page').getByRole('button', { name: /데모 시작/ }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/marketplace$/)
  await page.screenshot({ path: test.info().outputPath('marketplace-130.png'), fullPage: true })
  const overflow = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].filter((element) => element.getBoundingClientRect().right > innerWidth + 1).map((element) => element.className).slice(0, 20) }))
  expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width + 1)
})

test('search and sort survive detail navigation and browser back', async ({ page }) => {
  await page.goto('/marketplace?q=Browser&sort=name_asc')
  await page.getByRole('link', { name: 'Browser Demo Agent 상세 및 실행' }).click()
  await page.getByRole('link', { name: '다른 Agent 보기' }).click()
  await expect(page).toHaveURL(/marketplace\?q=Browser&sort=name_asc/)
  await expect(page.getByLabel('Agent 검색')).toHaveValue('Browser')
  await expect(page.getByLabel('정렬')).toHaveValue('name_asc')
})

test('dashboard shows published Agent management without a paid verification action', async ({ page, request }) => {
  await page.goto('/developer/revenue')
  await page.locator('.landing-page').getByRole('button', { name: /데모 시작/ }).click()
  await expect(page.getByText('v1.0.0 · 공개됨 · 0.01 USDC')).toBeVisible()
  await expect(page.getByRole('button', { name: /^검증v|^검증 v/ })).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('dashboard.png'), fullPage: true })
  const { result } = await (await request.get(`${fixtureUrl}/__scenario/${fixtureId()}`)).json()
  expect(result.requests.filter((item: { path: string }) => item.path.endsWith('/verify'))).toHaveLength(0)
})

test('developer publishes a draft once and the Marketplace then shows the active Agent', async ({ page, request }) => {
  await request.post(`${fixtureUrl}/__scenario/${fixtureId()}`, { data: { mode: 'draft' } })
  await start(page)
  await developerMode(page)
  await page.goto('/agents/browser-demo-agent')
  await page.getByRole('button', { name: '공개하기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Version을 공개할까요?' })
  await dialog.getByRole('button', { name: '공개하기', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Browser Demo Agent' }).getByRole('status')).toContainText('Version을 Marketplace에 공개했습니다.')
  await page.goto('/marketplace')
  await expect(page.getByRole('heading', { name: 'Browser Demo Agent' })).toBeVisible()
  const { result } = await (await request.get(`${fixtureUrl}/__scenario/${fixtureId()}`)).json()
  const publishes = result.requests.filter((item: { path: string; method: string }) => item.method === 'POST' && item.path.endsWith('/publish'))
  expect(publishes).toHaveLength(1)
  expect(publishes[0].authorization).toBe('Bearer fixture-browser-access')
})

test('landing and question screen fit the viewport', async ({ page }) => {
  await page.goto('/')
  await page.screenshot({ path: test.info().outputPath('landing.png'), fullPage: true })
  await page.goto('/agents/browser-demo-agent')
  await expect(page.getByRole('textbox')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('question.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
})

test('explicit demo exit clears access in either mode', async ({ page }) => {
  await start(page)
  if ((page.viewportSize()?.width ?? 0) <= 900) await page.getByRole('button', { name: '메뉴 열기' }).click()
  await page.getByRole('button', { name: '데모 종료', exact: true }).click()
  await expect(page.locator('.landing-page')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('agentstore.demo-access'))).toBeNull()
})
