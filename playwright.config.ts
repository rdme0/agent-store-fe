import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // Six concurrent dev-server transforms intermittently left pages unmounted for
  // the 30-second test timeout. Three still exercise independent browser contexts
  // concurrently while keeping the local Vite+HTTP fixture gate deterministic.
  fullyParallel: true,
  workers: 3,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'line' : 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node e2e/fixture-server.mjs', url: 'http://127.0.0.1:18080/health', reuseExistingServer: false, timeout: 120_000 },
    { command: 'node e2e/vite-server.mjs', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 120_000 },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
    { name: 'narrow-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 800 } } },
  ],
})
