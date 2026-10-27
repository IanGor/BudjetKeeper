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

test('a transaction can be moved to another account', async ({ board: page }) => {
  const openFirst = async () => {
    await page.locator('[data-entity-id]', { hasText: 'Аренда' }).click()
    const sheet = page.getByRole('dialog')
    await sheet.locator('.list-row').first().click()
    return sheet
  }
  const sheet = await openFirst()
  const from = sheet.getByLabel('Откуда', { exact: true })
  const original = await from.inputValue()
  const other = (await from.locator('option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value))).find((v) => v !== original)!
  await expect(sheet.getByLabel('Куда', { exact: true })).toHaveValue(await sheet.locator('select').nth(1).inputValue())
  await from.selectOption(other)
  await sheet.getByRole('button', { name: 'Готово' }).click()
  await expect(sheet.getByLabel('Откуда', { exact: true })).toBeHidden()

  // saving returns to the category's history; open the same operation again
  await sheet.locator('.list-row').first().click()
  await expect(sheet.getByLabel('Откуда', { exact: true })).toHaveValue(other)
  await sheet.getByLabel('Откуда', { exact: true }).selectOption(original)
  await sheet.getByRole('button', { name: 'Готово' }).click()
  await expect(sheet.getByLabel('Откуда', { exact: true })).toBeHidden()
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

test('round-up settings are a screen of their own inside the settings', async ({ board: page }) => {
  await page.getByRole('button', { name: 'Настройки', exact: true }).click()
  const sheet = page.getByRole('dialog')
  // the settings list shows only a summary line
  const row = sheet.getByRole('button', { name: /Округление/ })
  await expect(row).toContainText('до 10 ₽')
  await expect(sheet.getByLabel('Разница приходит на счёт')).toHaveCount(0)

  await row.click()
  await expect(sheet.getByRole('heading', { name: 'Округление' })).toBeVisible()
  await sheetIsClean(page)
  await expect(sheet.getByRole('radio', { name: 'до 10 ₽' })).toBeChecked()

  // an account added to the exceptions shows up in the list and can be removed
  await sheet.getByLabel('Не округлять траты со счетов: добавить').selectOption({ label: 'Бэйбик' })
  await expect(sheet.locator('.list-row', { hasText: 'Бэйбик' })).toHaveCount(1)
  await sheet.getByRole('button', { name: 'Убрать «Бэйбик»' }).click()
  await expect(sheet.locator('.list-row', { hasText: 'Бэйбик' })).toHaveCount(0)

  await sheet.getByRole('button', { name: 'Назад к настройкам' }).click()
  await expect(sheet.getByRole('heading', { name: 'Настройки' })).toBeVisible()
})

test('a category left out of rounding, transfers and income are never rounded', async ({ board: page }) => {
  const sheet = page.getByRole('dialog')
  const type = async (keys: string[]) => {
    for (const k of keys) await sheet.getByRole('button', { name: k, exact: true }).click()
  }

  // transfer between accounts: no round-up line (income is covered by the rules unit test)
  await dragCoin(page, 'Этот месяц', 'Бэйбик')
  await type(['1', '3'])
  await expect(sheet.locator('.delta.roundup')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()

  // spending on a category from the exceptions
  await page.getByRole('button', { name: 'Настройки', exact: true }).click()
  await sheet.getByRole('button', { name: /Округление/ }).click()
  await sheet.getByLabel('Не округлять траты на категории: добавить').selectOption({ label: 'Еда в городе' })
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await dragCoin(page, 'Этот месяц', 'Еда в городе')
  await type(['1', '3'])
  await expect(sheet.locator('.delta.roundup')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()

  // restore the shared budget
  await page.getByRole('button', { name: 'Настройки', exact: true }).click()
  await sheet.getByRole('button', { name: /Округление/ }).click()
  await sheet.getByRole('button', { name: 'Убрать «Еда в городе»' }).click()
  await expect(sheet.locator('.list-row', { hasText: 'Еда в городе' })).toHaveCount(0)
})

test('the feed lists all operations by day, newest first, with the time and the round-up', async ({ board: page }) => {
  // a spending with a round-up, so the feed has one to show
  await dragCoin(page, 'Этот месяц', 'Еда в городе')
  const sheet = page.getByRole('dialog')
  for (const k of ['1', '4', '3', '3']) await sheet.getByRole('button', { name: k, exact: true }).click()
  await sheet.getByRole('button', { name: 'Готово' }).click()
  await expect(sheet).toBeHidden()

  await page.getByRole('button', { name: 'Все операции' }).click()
  const feed = page.getByRole('dialog', { name: 'Все операции' })
  await expect(feed.locator('.feed-day h3').first()).toContainText('Сегодня')
  const first = feed.locator('.feed-row').first()
  await expect(first.locator('.feed-time')).toHaveText(/^\d{2}:\d{2}$/)
  await expect(first.locator('.feed-flow')).toContainText('Этот месяц → Еда в городе')
  await expect(first.locator('.feed-amt')).toHaveText(/−1\s433/)
  await expect(first.locator('.feed-round')).toContainText(/Округление \+7\s₽ → Подушка/)
  // a round-up is not a row of its own
  await expect(feed.locator('.feed-row', { hasText: 'Этот месяц → Подушка' })).toHaveCount(0)
  expect(await viewportOverflow(page)).toBeLessThanOrEqual(0)

  // days go from the latest back
  const days = await feed.locator('.feed-day h3').allTextContents()
  expect(days.length).toBeGreaterThan(0)
  await feed.getByRole('button', { name: 'Закрыть ленту' }).click()
  await expect(feed).toBeHidden()
})
