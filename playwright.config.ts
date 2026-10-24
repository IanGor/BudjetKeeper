import { defineConfig, devices } from '@playwright/test'
import type { SafeArea } from './e2e/fixtures'

// UI tests on the two phones the app is used on. They need the local Supabase
// stack (`npx supabase start`) with .env.local pointing at it; data is seeded by e2e/seed.ts.
const iphone = devices['iPhone 14 Pro']

export default defineConfig<{ safeArea: SafeArea }>({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure', locale: 'ru-RU' },
  webServer: {
    command: 'npx vite --port 5174 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    // installed to the home screen: full height, notch and home indicator insets
    {
      name: 'iphone-14-pro-pwa',
      use: { ...iphone, viewport: { width: 393, height: 852 }, safeArea: { top: 59, bottom: 34 } },
    },
    // in Safari: the browser bars take part of the height
    { name: 'iphone-14-pro-safari', use: { ...iphone, safeArea: { top: 0, bottom: 0 } } },
    // OnePlus 8 (1080×2400 @ 2.625) in Chrome, installed app
    {
      name: 'oneplus-8',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 412, height: 869 },
        screen: { width: 412, height: 915 },
        deviceScaleFactor: 2.625,
        userAgent:
          'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36',
        safeArea: { top: 0, bottom: 0 },
      },
    },
  ],
})
