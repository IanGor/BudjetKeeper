import { test, expect } from '@playwright/test'
import { nextMonth } from '../src/lib/monthlyBudget'

test('distribution, lost response retry, deferred limits and editing', async ({ page }) => {
  let distribution: object | null = null
  let limits: Record<string, number> = {}
  let savedAt: string | null = null
  let commits = 0
  let lastRequest: Record<string, unknown> | null = null
  let settings: unknown = null
  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url()
    const body = route.request().postDataJSON()
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' }
    let response: unknown = null
    if (url.includes('/rpc/distribute_budget')) {
      if (!distribution) {
        commits++
        lastRequest = body
        distribution = { id: body.p_id, source_id: body.p_source, month: nextMonth(), available_kopecks: 80000 }
        // Server committed, but its response did not reach the browser.
        await route.abort('failed')
        return
      }
      expect(body).toEqual(lastRequest)
      response = distribution
    } else if (url.includes('/rpc/entity_totals')) response = [{ entity_id: 'source', total_kopecks: 50000 }, { entity_id: 'regular', total_kopecks: 930000 }, { entity_id: 'savings', total_kopecks: 20000 }]
    else if (url.includes('/rpc/monthly_budget_state')) response = { current_limits: {}, next_limits: limits, saved_at: savedAt, distribution }
    else if (url.includes('/rpc/save_monthly_plan')) { limits = body.p_limits; savedAt = new Date().toISOString() }
    else if (url.includes('/households')) settings = body
    else response = []
    await route.fulfill({ status: 200, headers, body: JSON.stringify(response) })
  })
  await page.goto('/e2e/monthly-harness.html')
  await page.getByRole('button', { name: 'План', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Планирование бюджета' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('button', { name: 'Закрыть', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Распределить деньги', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Закрыть', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Распределить деньги', exact: true }).click()
  await expect(page.getByLabel('Счет-источник')).toHaveValue('source')
  await page.getByLabel('Перевод на Каждый день').fill('300')
  await page.getByRole('button', { name: 'Перевести остаток' }).last().click()
  await expect(page.getByLabel('Перевод на Накопления')).toHaveValue('700')
  await page.getByLabel('Перевод на Накопления').fill('800')
  await expect(page.getByRole('button', { name: 'Подтвердить распределение' })).toBeDisabled()
  await page.getByLabel('Перевод на Накопления').fill('200')
  await page.screenshot({ path: '/tmp/bk-distribution-mobile.png' })
  await page.getByRole('button', { name: 'Подтвердить распределение' }).click()
  await expect(page.getByText('Не удалось подтвердить результат.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await page.getByRole('button', { name: 'План', exact: true }).click()
  await page.getByRole('button', { name: 'Повторить подтверждение' }).click()
  await expect(page.getByText('Распределение завершено.', { exact: false })).toBeVisible()
  expect(commits).toBe(1)
  await page.getByRole('button', { name: 'Закончить позже' }).click()
  await expect(page.getByRole('button', { name: 'План', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'План', exact: true }).click()
  await page.getByRole('button', { name: 'Продолжить к лимитам' }).click()
  await expect(page.getByLabel('Лимит Продукты')).toHaveValue('200')
  await page.getByLabel('Лимит Продукты').fill('900')
  await expect(page.getByText('Превышение доступной суммы')).toBeVisible()
  await page.screenshot({ path: '/tmp/bk-limits-mobile.png' })
  // Screenshots and layout checks on both target sizes.
  await expect(page.locator('.sheet')).toBeVisible()
  expect(await page.locator('.sheet').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.screenshot({ path: '/tmp/bk-limits-desktop.png' })
  await page.getByRole('button', { name: 'Сохранить лимиты' }).click()
  expect(limits).toEqual({ food: 90000, travel: 10000 })
  await expect(page.locator('.plan-bar-text')).toContainText('300')
  await page.getByRole('button', { name: 'План', exact: true }).click()
  await page.getByRole('button', { name: 'Редактировать лимиты' }).click()
  await expect(page.getByLabel('Лимит Продукты')).toHaveValue('900')
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await page.getByRole('button', { name: 'Настройки', exact: true }).click()
  await page.getByLabel('Источник для распределения').selectOption('savings')
  await expect.poll(() => settings).toEqual({ distribution_source_id: 'savings' })
})
