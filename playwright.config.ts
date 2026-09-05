import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'line' : 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node e2e/fixture-server.mjs', url: 'http://127.0.0.1:18080/health', reuseExistingServer: false, timeout: 120_000 },
    { command: 'node e2e/vite-server.mjs', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 120_000 },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
})
