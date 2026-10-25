import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { backgroundAlpha, clippedText, overlaps, textBoxes, viewportOverflow } from './layout'

async function sheetIsClean(page: Page) {
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await page.waitForTimeout(500) // slide-in animation
  // an opaque sheet: the board must not show through its text (the "text over text" bug)
  expect(await backgroundAlpha(sheet)).toBe(1)
  expect(overlaps(await textBoxes(sheet)), 'overlapping text').toEqual([])
  expect(await clippedText(sheet), 'text cut off').toEqual([])
  expect(await viewportOverflow(page)).toBeLessThanOrEqual(0)
  const box = (await sheet.boundingBox())!
  const vp = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5)
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 0.5)
  return sheet
}

/** Drags a coin onto another one with the mouse (pointer events, as a finger would). */
async function dragCoin(page: Page, from: string, to: string) {
  const a = (await page.locator('[data-entity-id]', { hasText: from }).first().locator('.orb').boundingBox())!
  const b = (await page.locator('[data-entity-id]', { hasText: to }).first().locator('.orb').boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 12, { steps: 4 })
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
}

test('expense: drag an account onto a category, type the sum, done', async ({ board: page }) => {
  const amount = page.locator('[data-entity-id]', { hasText: 'Транспорт' }).locator('.coin-amount')
  // the seeded budget is shared by all device projects, so compare with what was there
  const before = Number((await amount.textContent())!.replace(/\D/g, ''))
  await dragCoin(page, 'Этот месяц', 'Транспорт')

  const sheet = await sheetIsClean(page)
  await expect(sheet.getByRole('heading')).toHaveText('Расход')
  for (const k of ['1', '2', '0', '+', '3', '0']) await sheet.getByRole('button', { name: k, exact: true }).click()
  await expect(sheet.locator('.display')).toContainText('150')
  // the Done key is on screen without scrolling the sheet
  const done = sheet.getByRole('button', { name: 'Готово' })
  await expect(done).toBeInViewport({ ratio: 1 })
  await done.click()
  await expect(sheet).toBeHidden()
  await expect(amount).toHaveText(String(before + 150).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f'))
})

test('category sheet: operations, then settings', async ({ board: page }) => {
  await page.locator('[data-entity-id]', { hasText: 'Продукты' }).click()
  const sheet = await sheetIsClean(page)
  await expect(sheet.locator('.list-row')).toHaveCount(1)
  await sheet.getByRole('button', { name: 'Настройки' }).click()
  await sheetIsClean(page)
  await expect(sheet.getByRole('button', { name: 'Сохранить' })).toBeVisible()
})

test('edit a transaction from the history', async ({ board: page }) => {
  await page.locator('[data-entity-id]', { hasText: 'Аренда' }).click()
  const sheet = await sheetIsClean(page)
  await sheet.locator('.list-row').first().click()
  await expect(sheet.getByRole('heading')).toHaveText('Расход')
  await sheetIsClean(page)
  await expect(sheet.getByRole('button', { name: 'Удалить операцию' })).toBeVisible()
})

test('account balance adjustment sheet', async ({ board: page }) => {
  await page.locator('[data-entity-id]', { hasText: 'Этот месяц' }).click()
  await page.getByRole('button', { name: 'Изменить баланс' }).click()
  const sheet = await sheetIsClean(page)
  await expect(sheet.getByRole('heading')).toHaveText('Баланс счёта')
  await expect(sheet.getByRole('button', { name: 'Готово' })).toBeInViewport({ ratio: 1 })
})

test('new category sheet', async ({ board: page }) => {
  await page.getByRole('button', { name: 'Категория', exact: true }).click()
  await sheetIsClean(page)
})

test('settings sheet', async ({ board: page }) => {
  await page.getByRole('button', { name: 'Настройки', exact: true }).click()
  const sheet = await sheetIsClean(page)
  await expect(sheet.getByText('Регистрация')).toHaveCount(0)
})

test('edit mode: long press, then Done', async ({ board: page }) => {
  const coin = page.locator('[data-entity-id]', { hasText: 'Транспорт' }).locator('.orb')
  const c = (await coin.boundingBox())!
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(700)
  await page.mouse.up()
  await expect(page.locator('.board.editing')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Скрыть «Транспорт»' })).toBeVisible()
  expect(overlaps(await textBoxes(page.locator('.topbar'))), 'overlapping text').toEqual([])
  await page.getByRole('button', { name: 'Готово' }).click()
  await expect(page.locator('.board.editing')).toHaveCount(0)
})

test('a spending is rounded up to 10 ₽, the difference goes to the round-up account', async ({ board: page }) => {
  // the seeded budget is shared by all device projects, so compare with what was there;
  // «Еда в городе» is over its plan already and no other test counts its operations
  const amount = (name: string) => page.locator('[data-entity-id]', { hasText: name }).first().locator('.coin-amount')
  const read = async (name: string) => Number((await amount(name).textContent())!.replace(/[^\d−]/g, '').replace('−', '-'))
  const before = { from: await read('Этот месяц'), category: await read('Еда в городе'), roundup: await read('Подушка') }

  await dragCoin(page, 'Этот месяц', 'Еда в городе')
  const sheet = page.getByRole('dialog')
  for (const k of ['1', '4', '3', '3']) await sheet.getByRole('button', { name: k, exact: true }).click()
  // before saving, the sheet tells where the round-up goes
  await expect(sheet.locator('.delta.roundup')).toHaveText(/С «Этот месяц» спишется 1\s440\s₽ · 7\s₽ → «Подушка»/)
  await sheetIsClean(page)
  const done = sheet.getByRole('button', { name: 'Готово' })
  await expect(done).toBeInViewport({ ratio: 1 })
  await done.click()
  await expect(sheet).toBeHidden()

  // the category gets the real price, the account pays the rounded sum
  await expect.poll(() => read('Еда в городе')).toBe(before.category + 1433)
  await expect.poll(() => read('Этот месяц')).toBe(before.from - 1440)
  await expect.poll(() => read('Подушка')).toBe(before.roundup + 7)

  // a round sum adds nothing
  await dragCoin(page, 'Этот месяц', 'Еда в городе')
  for (const k of ['5', '0']) await sheet.getByRole('button', { name: k, exact: true }).click()
  await expect(sheet.locator('.delta.roundup')).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Готово' }).click()
  await expect.poll(() => read('Подушка')).toBe(before.roundup + 7)
  await expect.poll(() => read('Этот месяц')).toBe(before.from - 1490)

  // rounding can be switched off for one operation
  await dragCoin(page, 'Этот месяц', 'Еда в городе')
  for (const k of ['1', '5']) await sheet.getByRole('button', { name: k, exact: true }).click()
  await sheet.getByRole('button', { name: 'Не округлять' }).click()
  await expect(sheet.locator('.delta.roundup > span')).toHaveText('Без округления')
  await sheetIsClean(page)
  await sheet.getByRole('button', { name: 'Готово' }).click()
  await expect.poll(() => read('Этот месяц')).toBe(before.from - 1505)
  await expect.poll(() => read('Подушка')).toBe(before.roundup + 7)
})

test('round-ups can be moved to another account in its settings', async ({ board: page }) => {
  const open = async (name: string) => {
    await page.locator('[data-entity-id]', { hasText: name }).first().click()
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('button', { name: 'Настройки' }).click()
    return sheet
  }
  let sheet = await open('Бэйбик')
  const sw = sheet.getByRole('switch', { name: /Копилка округлений/ })
  await expect(sw).not.toBeChecked()
  await sw.check()
  await sheet.getByRole('button', { name: 'Сохранить' }).click()
  await expect(sheet).toBeHidden()

  // only one account collects them: «Подушка» lost it; give it back for the other devices
  sheet = await open('Подушка')
  await expect(sheet.getByRole('switch', { name: /Копилка округлений/ })).not.toBeChecked()
  await sheet.getByRole('switch', { name: /Копилка округлений/ }).check()
  await sheet.getByRole('button', { name: 'Сохранить' }).click()
  await expect(sheet).toBeHidden()
  sheet = await open('Бэйбик')
  await expect(sheet.getByRole('switch', { name: /Копилка округлений/ })).not.toBeChecked()
})
