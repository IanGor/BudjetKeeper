import { expect, test } from './fixtures'
import { clippedText, overlaps, textBoxes, viewportOverflow } from './layout'

// Layout regressions seen on iPhone 14 Pro and OnePlus 8: overlapping captions,
// a category grid that left a whole free row empty, text cut by section edges.

for (const incomeOpen of [false, true]) {
  test(`board layout, income ${incomeOpen ? 'open' : 'closed'}`, async ({ board: page }) => {
    if (incomeOpen) {
      await page.getByRole('button', { name: /Доходы/ }).click()
      await expect(page.getByRole('button', { name: /Доходы/ })).toHaveAttribute('aria-expanded', 'true')
      await page.waitForTimeout(450) // collapse animation
    }
    const board = page.locator('.board')

    expect(await viewportOverflow(page), 'horizontal page scroll').toBeLessThanOrEqual(0)
    expect(overlaps(await textBoxes(board)), 'overlapping text').toEqual([])
    expect(await clippedText(board), 'text cut off').toEqual([])

    // the whole board fits the screen: nothing below the home indicator
    const box = await board.boundingBox()
    const vh = page.viewportSize()!.height
    expect(box!.y + box!.height).toBeLessThanOrEqual(vh + 0.5)

    const grid = await page.locator('.pager').evaluate((pager) => {
      const p = pager.getBoundingClientRect()
      const cells = [...pager.querySelectorAll<HTMLElement>('.pager-cell')]
      const firstPage = cells.filter((c) => {
        const r = c.getBoundingClientRect()
        return r.left >= p.left - 1 && r.right <= p.right + 1
      })
      const coinHeight = Math.max(...cells.map((c) => (c.querySelector('.coin-cell') as HTMLElement).offsetHeight))
      const rows = new Set(firstPage.map((c) => Math.round(c.getBoundingClientRect().top))).size
      const clipped = firstPage
        .filter((c) => (c.querySelector('.coin-cell') as HTMLElement).getBoundingClientRect().bottom > p.bottom + 0.5)
        .map((c) => c.textContent)
      return { height: p.height, coinHeight, rows, clipped, onePage: firstPage.length === cells.length }
    })
    expect(grid.clipped, 'category coins cut at the bottom').toEqual([])
    expect(grid.rows * grid.coinHeight).toBeLessThanOrEqual(grid.height + 0.5)
    // with more categories than fit, no free row may stay unused
    if (!grid.onePage) expect(grid.height - grid.rows * grid.coinHeight, 'room for one more row').toBeLessThan(grid.coinHeight)
  })
}

// installed apps (iPhone from the home screen, OnePlus); in Safari the browser bars leave room for one
test('a tall screen has room for at least two rows of categories with income open', async ({ board: page }) => {
  test.skip(page.viewportSize()!.height < 800, 'short viewport (browser bars)')
  await page.getByRole('button', { name: /Доходы/ }).click()
  await page.waitForTimeout(450)
  const rows = await page.locator('.pager').evaluate((pager) => {
    const p = pager.getBoundingClientRect()
    const tops = [...pager.querySelectorAll('.pager-cell')]
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.left >= p.left - 1 && r.right <= p.right + 1)
      .map((r) => Math.round(r.top))
    return new Set(tops).size
  })
  expect(rows).toBeGreaterThanOrEqual(2)
})

test('categories page horizontally and the dots follow', async ({ board: page }) => {
  // eleven tiles: the iPhone in Safari has room for two rows only
  const pager = page.locator('.pager')
  const dots = page.locator('.dot')
  if ((await dots.count()) === 0) test.skip(true, 'all categories fit on one page')
  await pager.evaluate((el) => el.scrollTo({ left: el.clientWidth }))
  await expect(dots.nth(1)).toHaveClass(/on/)
})

test('long names wrap to two lines instead of overflowing', async ({ board: page }) => {
  const name = page.locator('[data-entity-id]', { hasText: 'Красота и одежда' }).locator('.coin-name')
  const lines = await name.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)))
  expect(lines).toBeLessThanOrEqual(2)
  await expect(name).toHaveText('Красота и одежда')
})

test('amounts are whole rubles and the largest ones fit their coin', async ({ board: page }) => {
  const coins = page.locator('[data-entity-id]')
  await expect(coins.filter({ hasText: 'Вклад' }).locator('.coin-amount')).toHaveText('99\u202f999\u202f999')
  await expect(coins.filter({ hasText: 'Путешествия' }).locator('.coin-amount')).toHaveText('−99\u202f999\u202f999')
  await expect(coins.filter({ hasText: 'Подписки' }).locator('.coin-amount').last()).toHaveText('99\u202f999\u202f999')
  // no "тыс"/"млн" anywhere: every caption is digits only
  for (const text of await page.locator('.coin-amount, .coin-plan').allTextContents()) {
    expect(text).toMatch(/^(из )?−?\d{1,3}(\u202f\d{3})*$/)
  }
  const wider = await page.locator('.coin-cell').evaluateAll((cells) =>
    cells.flatMap((cell) =>
      [...cell.querySelectorAll<HTMLElement>('.coin-amount, .coin-plan')]
        .filter((t) => t.getBoundingClientRect().width > cell.clientWidth)
        .map((t) => t.textContent),
    ),
  )
  expect(wider, 'amounts wider than their coin').toEqual([])
})
