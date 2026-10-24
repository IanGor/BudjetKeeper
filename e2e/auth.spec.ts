import { expect, test } from './fixtures'
import { overlaps, textBoxes, viewportOverflow } from './layout'

test('sign-in only: registration is closed', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Регистрация' })).toHaveCount(0)
  await expect(page.getByText('Регистрация закрыта')).toBeVisible()
  expect(overlaps(await textBoxes(page.locator('.auth-card')))).toEqual([])
  expect(await viewportOverflow(page)).toBeLessThanOrEqual(0)
})
