import { expect, test } from './fixtures'

// The splash must never last forever: a failed or silent server ends in a retry screen,
// and a signed-in user with a household is never sent to onboarding because of a network error.

const rest = '**/rest/v1/**'

test('a failing server shows the retry screen, and retry recovers', async ({ board: page }) => {
  await page.route(rest, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }))
  await page.reload()

  await expect(page.getByText('Не удаётся связаться с сервером')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible()
  await expect(page.getByText('Загрузка…')).toHaveCount(0)
  await expect(page.getByText('Создать бюджет')).toHaveCount(0)

  await page.unroute(rest)
  await page.getByRole('button', { name: 'Повторить' }).click()
  await expect(page.locator('[data-entity-id]').first()).toBeVisible()
})

test('a server that never answers ends in the retry screen', async ({ board: page }) => {
  await page.route(rest, () => {}) // the request just hangs
  await page.clock.install()
  await page.reload()
  await expect(page.getByText('Загрузка…')).toBeVisible()

  await page.clock.fastForward(21_000)
  await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible()
})
