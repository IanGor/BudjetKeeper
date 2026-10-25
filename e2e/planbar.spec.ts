import { expect, test } from './fixtures'

// The bar at the bottom: spent this month of the planned spending, and the money
// on the accounts that count in the total balance.

const rub = (s: string) => Number(s.replace(/[^\d−-]/g, '').replace('−', '-'))

test('the bottom bar shows spent of the plan and the money on the accounts', async ({ board: page }) => {
  const bar = page.locator('.plan-bar')
  const [spent, planned] = (await bar.locator('.plan-bar-text > span').first().locator('.num').allTextContents()).map(rub)
  const available = rub((await bar.locator('.plan-bar-text > span').last().locator('.num').textContent())!)

  // the same numbers as the section heads; the plan is the sum of the category plans
  expect(spent).toBe(rub((await page.locator('.expenses .section-meta').textContent())!))
  expect(available).toBe(rub((await page.locator('.section').nth(1).locator('.section-meta').textContent())!))
  const plans = (await page.locator('.expenses .coin-plan').allTextContents()).filter(Boolean).map(rub)
  expect(planned).toBe(plans.reduce((a, b) => a + b, 0))

  const track = bar.getByRole('progressbar')
  await expect(track).toHaveAttribute('aria-valuenow', String(spent * 100))
  await expect(track).toHaveAttribute('aria-valuemax', String(planned * 100))
  // the seeded budget is overspent: a full red bar
  expect(spent).toBeGreaterThan(planned)
  await expect(track).toHaveClass(/over/)
  const fill = await track.evaluate((t) => t.querySelector('.plan-bar-fill')!.getBoundingClientRect().width / t.clientWidth)
  expect(fill).toBeCloseTo(1, 2)

  // pinned to the bottom of the board, above the home indicator
  const board = (await page.locator('.board').boundingBox())!
  const box = (await bar.boundingBox())!
  const padBottom = await page.locator('.board').evaluate((b) => parseFloat(getComputedStyle(b).paddingBottom))
  expect(box.y + box.height).toBeCloseTo(board.y + board.height - padBottom, 0)
})

test('the tick on the bar marks how much of the month has passed', async ({ board: page }) => {
  const now = new Date()
  const elapsed =
    (now.getTime() - new Date(now.getFullYear(), now.getMonth(), 1).getTime()) /
    (new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - new Date(now.getFullYear(), now.getMonth(), 1).getTime())
  const at = await page.locator('.plan-bar-track').evaluate((t) => {
    const r = t.getBoundingClientRect()
    const tick = t.querySelector('.plan-bar-today')!.getBoundingClientRect()
    return (tick.left + tick.width / 2 - r.left) / r.width
  })
  expect(at).toBeCloseTo(elapsed, 2)
})
