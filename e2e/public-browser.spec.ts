import { expect, test } from '@playwright/test'

test.describe('AgentStore public browser flow', () => {
  test('renders the landing story and reaches Marketplace', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /진정한 자동화/ })).toBeVisible()
    await expect(page.locator('.landing-page').getByRole('button', { name: /데모 시작/ })).toBeVisible()
    await expect(page.getByText('클릭 한 번으로 AgentStore 데모를 시작합니다.')).toBeVisible()
    await expect(page.getByRole('link', { name: '개발자 대시보드' })).toHaveCount(0)
    await expect(page.getByRole('group', { name: '화면 모드' })).toHaveCount(0)
    await expect(page.locator('script[src*="challenges.cloudflare.com"]')).toHaveCount(0)
    await page.locator('.landing-page').getByRole('button', { name: /데모 시작/ }).click()
    await expect(page).toHaveURL(/\/marketplace$/)
    await expect(page.locator('#agents-title')).toBeVisible()
  })

  test('starts the demo in developer mode and switches between developer and easy presentation', async ({ page }) => {
    await page.goto('/')
    await page.locator('.landing-page').getByRole('button', { name: /데모 시작/ }).click()

    await expect(page.locator('.app-shell--developer')).toHaveCount(1)
    const mobile = (page.viewportSize()?.width ?? 0) <= 900
    if (mobile) await page.getByRole('button', { name: '메뉴 열기' }).click()
    const modeToggle = mobile ? page.getByRole('dialog', { name: '모바일 주요 탐색' }).getByRole('group', { name: '화면 모드' }) : page.getByRole('group', { name: '화면 모드' })
    await expect(modeToggle.getByRole('button', { name: '개발자 모드' })).toHaveAttribute('aria-pressed', 'true')
    await modeToggle.getByRole('button', { name: '쉬운 사용' }).click()

    await expect(page).toHaveURL(/\/marketplace$/)
    await expect(page.locator('.app-shell--developer')).toHaveCount(0)
    if (mobile) await page.getByRole('button', { name: '메뉴 열기' }).click()
    const easyToggle = mobile ? page.getByRole('dialog', { name: '모바일 주요 탐색' }).getByRole('group', { name: '화면 모드' }) : page.getByRole('group', { name: '화면 모드' })
    await easyToggle.getByRole('button', { name: '개발자 모드' }).click()
    await expect(page.locator('.app-shell--developer')).toHaveCount(1)

    await page.goto('/')
    await expect(page.locator('.app-shell--developer')).toHaveCount(0)
    await expect(page.getByRole('group', { name: '화면 모드' })).toHaveCount(0)
    if (mobile) {
      await page.getByRole('button', { name: '메뉴 열기' }).click()
      await expect(page.getByRole('dialog', { name: '모바일 주요 탐색' }).getByRole('group', { name: '화면 모드' })).toHaveCount(0)
    }
    await page.goto('/marketplace')
    await expect(page.getByRole('button', { name: '데모 종료' })).toHaveCount(0)
    await expect(page.getByText('연결됨')).toHaveCount(0)
  })

  test('requires demo access before direct Marketplace navigation', async ({ page }) => {
    await page.goto('/marketplace')
    await expect(page).toHaveURL(/\/?demo=1$/)
    await expect(page.locator('.landing-page').getByRole('button', { name: /데모 시작/ })).toBeVisible()
  })

  test('redirects an unauthenticated developer route to the demo entry point', async ({ page }) => {
    await page.goto('/developer/revenue')
    await expect(page).toHaveURL(/\/?developer=1$/)
    await expect(page.locator('.landing-page').getByRole('button', { name: /데모 시작/ })).toBeVisible()
  })

  test('completes the one-click access exchange and opens the Bearer dashboard', async ({ page }) => {
    await page.goto('/?developer=1')
    await expect(page.locator('.landing-page').getByRole('button', { name: /데모 시작/ })).toBeVisible()
    await page.locator('.landing-page').getByRole('button', { name: /데모 시작/ }).click()
    await expect(page).toHaveURL(/\/developer\/revenue$/)
    await expect(page.getByRole('heading', { name: '내 Agent와 실제 검증' })).toBeVisible()
    const storedAccess = await page.evaluate(() => window.localStorage.getItem('agentstore.demo-access'))
    expect(storedAccess).toContain('fixture-browser-access')
    const requests = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
    expect(requests.some((url) => url.includes('/api/developer/me'))).toBe(true)
  })
})
