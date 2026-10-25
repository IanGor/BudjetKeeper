import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Savings accounts can be kept out of the total balance (the sum next to «Счета»).

const rub = (s: string) => Number(s.replace(/[^\d−-]/g, '').replace('−', '-'))

/** Sum of the shown balances of accounts that count, and the total in the head. */
async function balances(page: Page) {
  const accounts = page.locator('.section').nth(1)
  const coins = await accounts.locator('[data-entity-id]').evaluateAll((els) =>
    els.map((el) => ({
      name: el.querySelector('.coin-name')!.textContent!,
      amount: el.querySelector('.coin-amount')!.textContent!,
      aside: el.querySelector('.coin-amount')!.classList.contains('aside'),
    })),
  )
  const counted = coins.filter((c) => !c.aside).reduce((sum, c) => sum + rub(c.amount), 0)
  const head = rub((await accounts.locator('.section-meta').textContent())!)
  return { coins, counted, head }
}

test('the total balance leaves out savings accounts', async ({ board: page }) => {
  const b = await balances(page)
  expect(b.coins.filter((c) => c.aside).map((c) => c.name).sort()).toEqual(['Вклад', 'Подушка'])
  expect(b.head).toBe(b.counted)
})

test('an account can be taken out of the total balance and back', async ({ board: page }) => {
  const before = await balances(page)
  const account = before.coins.find((c) => c.name === 'Этот месяц')!

  const toggle = async (on: boolean) => {
    await page.locator('[data-entity-id]', { hasText: 'Этот месяц' }).first().click()
    const sheet = page.locator('.sheet')
    await sheet.getByRole('button', { name: 'Настройки' }).click()
    const sw = sheet.getByRole('switch', { name: /Учитывать в общем балансе/ })
    await expect(sw).toBeChecked({ checked: !on })
    await sw.setChecked(on)
    await sheet.getByRole('button', { name: 'Сохранить' }).click()
    await expect(sheet).toBeHidden()
  }

  await toggle(false)
  await expect.poll(async () => (await balances(page)).head).toBe(before.head - rub(account.amount))
  await expect(page.locator('[data-entity-id]', { hasText: 'Этот месяц' }).first().locator('.coin-amount')).toHaveClass(/aside/)

  // it stays out after a reload: the setting is saved
  await page.reload()
  await expect.poll(async () => (await balances(page)).head).toBe(before.head - rub(account.amount))

  await toggle(true)
  await expect.poll(async () => (await balances(page)).head).toBe(before.head)
})
