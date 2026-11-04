import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'e2e', testMatch: 'monthly-budget.spec.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:5175', viewport: { width: 393, height: 852 }, locale: 'ru-RU', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } },
  webServer: { command: 'npx vite --port 5175 --strictPort --host 127.0.0.1', url: 'http://127.0.0.1:5175', reuseExistingServer: true },
})
