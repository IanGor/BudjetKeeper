import { test as base, expect, type Page } from '@playwright/test'
import { USER } from './seed'

export interface SafeArea {
  top: number
  bottom: number
}

/**
 * `safeArea` emulates the notch / home indicator: browsers in tests report
 * env(safe-area-inset-*) = 0, so the app's --safe-* variables are overridden.
 * `board` is a signed-in page showing the seeded budget.
 */
export const test = base.extend<{ safeArea: SafeArea; board: Page }>({
  safeArea: [{ top: 0, bottom: 0 }, { option: true }],
  page: async ({ page, safeArea }, use) => {
    await page.addInitScript((s) => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style')
        style.textContent = `:root { --safe-top: ${s.top}px !important; --safe-bottom: ${s.bottom}px !important; }`
        document.head.append(style)
      })
    }, safeArea)
    await use(page)
  },
  board: async ({ page }, use) => {
    await page.goto('/')
    await page.getByLabel('Email').fill(USER.email)
    await page.getByLabel('Пароль').fill(USER.password)
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(page.locator('[data-entity-id]').first()).toBeVisible()
    await use(page)
  },
})

export { expect }
