import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'e2e', testMatch: 'roundup-harness.spec.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:5176', viewport: { width: 393, height: 852 }, locale: 'ru-RU', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } },
  webServer: { command: 'npx vite --port 5176 --strictPort --host 127.0.0.1', url: 'http://127.0.0.1:5176', reuseExistingServer: true },
})
