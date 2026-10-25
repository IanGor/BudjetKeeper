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

    const grid = await page.locator('.expenses .pager').evaluate((pager) => {
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
  const rows = await page.locator('.expenses .pager').evaluate((pager) => {
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
  const pager = page.locator('.expenses .pager')
  const dots = page.locator('.expenses .dot')
  if ((await dots.count()) === 0) test.skip(true, 'all categories fit on one page')
  await pager.evaluate((el) => el.scrollTo({ left: el.clientWidth }))
  await expect(dots.nth(1)).toHaveClass(/on/)
})

test('long names wrap to two lines instead of overflowing', async ({ board: page }) => {
  const name = page.locator('[data-entity-id]', { hasText: 'Красота и одежда' }).locator('.coin-name > span')
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

test('incomes, accounts and categories share one grid of 4 equal, symmetric columns', async ({ board: page }) => {
  await page.getByRole('button', { name: /Доходы/ }).click()
  await page.waitForTimeout(450)
  const vw = page.viewportSize()!.width
  const sections = await page.locator('.section').evaluateAll((els) =>
    els.map((section) => {
      const pager = section.querySelector('.pager')!.getBoundingClientRect()
      // the cells of the page in view
      const cells = [...section.querySelectorAll('.pager-cell')]
        .map((c) => c.getBoundingClientRect())
        .filter((r) => r.left >= pager.left - 1 && r.right <= pager.right + 1)
      const firstRow = cells.filter((r) => Math.abs(r.top - cells[0].top) < 1)
      const orbs = [...section.querySelectorAll('.orb')].map((o) => o.getBoundingClientRect().width)
      return {
        lefts: firstRow.map((r) => Math.round(r.left)),
        widths: firstRow.map((r) => r.width),
        orbs: [...new Set(orbs.map(Math.round))],
      }
    }),
  )
  expect(sections).toHaveLength(3)
  for (const s of sections) {
    expect(s.lefts, 'four coins per row').toHaveLength(4)
    expect(s.orbs, 'one orb size').toHaveLength(1)
    for (const w of s.widths) expect(w).toBeCloseTo(s.widths[0], 0)
    expect(s.lefts, 'columns line up across sections').toEqual(sections[0].lefts)
  }
  expect(sections[0].orbs).toEqual(sections[2].orbs)
  // the row is centered on the screen: equal margins left and right
  const [first, , , last] = sections[0].lefts
  const right = vw - (last + sections[0].widths[3])
  expect(Math.abs(first - right)).toBeLessThanOrEqual(1)
})

test('a long name does not shift the amount: every row keeps one grid', async ({ board: page }) => {
  await page.getByRole('button', { name: /Доходы/ }).click()
  await page.waitForTimeout(450)
  // rows of coins in view, per section; one entry per row: the distinct tops of each part
  const misaligned = await page.locator('.section').evaluateAll((sections) =>
    sections.flatMap((section) => {
      const pager = section.querySelector('.pager')!.getBoundingClientRect()
      const coins = [...section.querySelectorAll<HTMLElement>('.coin-cell:not(.add-tile)')].filter((c) => {
        const r = c.getBoundingClientRect()
        return r.left >= pager.left - 1 && r.right <= pager.right + 1 && r.bottom <= pager.bottom + 1
      })
      const rows = new Map<number, HTMLElement[]>()
      for (const c of coins) {
        const top = Math.round(c.getBoundingClientRect().top)
        rows.set(top, [...(rows.get(top) ?? []), c])
      }
      return [...rows.values()].flatMap((row) =>
        // .coin-name > span: the text itself, so the first lines of all names line up too
        ['.orb', '.coin-name', '.coin-name > span', '.coin-amount', '.coin-plan']
          .map((part) => ({
            part,
            tops: [...new Set(row.map((c) => c.querySelector(part)?.getBoundingClientRect().top).filter((t) => t !== undefined).map(Math.round))],
            names: row.map((c) => c.querySelector('.coin-name')!.textContent),
          }))
          .filter((p) => p.tops.length > 1)
          .map((p) => `${p.part} at ${p.tops.join('/')}: ${p.names.join(', ')}`),
      )
    }),
  )
  expect(misaligned).toEqual([])
})

test('the board follows the golden ratio and a 4 px rhythm', async ({ board: page }) => {
  const PHI = 1.618
  const m = await page.locator('.expenses').evaluate((section) => {
    const cell = section.querySelector<HTMLElement>('.pager-cell')!
    const coin = cell.querySelector<HTMLElement>('.coin-cell')!
    const cells = [...section.querySelectorAll<HTMLElement>('.pager-cell')]
    const tops = [...new Set(cells.map((c) => Math.round(c.getBoundingClientRect().top)))].sort((a, b) => a - b)
    const px = (sel: string, prop: 'height' | 'fontSize') => parseFloat(getComputedStyle(document.querySelector(sel)!)[prop])
    return {
      col: cell.getBoundingClientRect().width,
      orb: coin.querySelector('.orb')!.getBoundingClientRect().width,
      pitch: tops.length > 1 ? tops[1] - tops[0] : null,
      slots: ['.coin-name', '.coin-amount', '.coin-plan'].map((s) => px(s, 'height')),
      fonts: ['.coin-name', '.coin-amount', '.section-meta', '.section-title', '.large-title'].map((s) => px(s, 'fontSize')),
    }
  })
  // orb : column = 1 : φ, so the gap between orbs is orb / φ
  expect(m.orb).toBeCloseTo(m.col / PHI, 0)
  // a cell is at most a golden rectangle
  if (m.pitch) expect(m.pitch).toBeLessThanOrEqual(m.col * PHI + 1)
  for (const h of m.slots) expect(h % 4, `slot height ${h}`).toBe(0)
  // type scale with step √φ: 12, 15, 15, 19, 31
  expect(m.fonts).toEqual([12, 15, 15, 19, 31])
})

test('installed on the phone: three rows of categories with income closed', async ({ board: page }) => {
  test.skip(page.viewportSize()!.height < 800, 'short viewport (browser bars)')
  const rows = await page.locator('.expenses .pager-cell').evaluateAll(
    (cells) => new Set(cells.map((c) => Math.round(c.getBoundingClientRect().top))).size,
  )
  expect(rows).toBeGreaterThanOrEqual(3)
})
