import { expect, test } from './fixtures'
import { USER } from './seed'

// At 00:00 on the 1st a new month starts by itself in an app that stays open:
// spending and income start from zero, plans and account balances stay.

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

test('midnight on the 1st starts a new month', async ({ page }) => {
  // the seeded operations are dated today: ten seconds before the end of this month
  const now = new Date()
  const eve = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 50)
  await page.clock.install({ time: eve })

  await page.goto('/')
  await page.getByLabel('Email').fill(USER.email)
  await page.getByLabel('Пароль').fill(USER.password)
  await page.getByRole('button', { name: 'Войти' }).click()

  const coin = (name: string) => page.locator('[data-entity-id]', { hasText: name }).first()
  await expect(page.locator('.large-title')).toHaveText(MONTHS[eve.getMonth()])
  await expect(coin('Продукты').locator('.coin-amount')).toHaveText('45 230')
  const balance = await coin('Вклад').locator('.coin-amount').textContent()

  await page.clock.runFor(20_000)

  await expect(page.locator('.large-title')).toHaveText(MONTHS[(eve.getMonth() + 1) % 12])
  await expect(coin('Продукты').locator('.coin-amount')).toHaveText('0')
  await expect(coin('Продукты').locator('.coin-plan')).toHaveText('из 70 000')
  await expect(coin('Продукты').locator('.orb')).toHaveCSS('--fill', '0')
  await expect(page.locator('.expenses .section-meta')).toHaveText('0 ₽')
  await expect(page.locator('.section').first().locator('.section-meta')).toHaveText('0 ₽')
  // accounts keep their balance
  await expect(coin('Вклад').locator('.coin-amount')).toHaveText(balance!)
})
