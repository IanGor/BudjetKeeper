import { test, expect } from '@playwright/test'

test('rounding switch saves and restores settings', async ({ page }) => {
  const changes: boolean[] = []
  await page.route('**/rest/v1/households**', async (route) => {
    changes.push(route.request().postDataJSON().roundup_enabled)
    await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
  })
  await page.goto('/e2e/roundup-harness.html')
  const toggle = page.getByRole('switch', { name: /Округление/ })
  await expect(toggle).toBeChecked()
  await expect(page.getByLabel('Разница приходит на счёт')).toHaveValue('savings')
  await toggle.uncheck()
  await expect(page.getByLabel('Разница приходит на счёт')).toHaveCount(0)
  await page.waitForTimeout(350)
  await page.screenshot({ path: '/tmp/bk-roundup-off.png' })
  await toggle.check()
  await expect(page.getByLabel('Разница приходит на счёт')).toHaveValue('savings')
  await page.waitForTimeout(350)
  await page.screenshot({ path: '/tmp/bk-roundup-on.png' })
  await expect.poll(() => changes).toEqual([false, true])
})
