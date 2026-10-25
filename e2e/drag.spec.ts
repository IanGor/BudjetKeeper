import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Rearranging coins in edit mode. The bug: holding a coin over a corner flipped
// the row a whole screen away every half second (the edge zone reached into the
// corner coin), so the coin could not be put there; the empty cells after the
// last coin were no target at all.

const center = async (l: Locator) => {
  const b = (await l.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

/** Long press on a coin until edit mode, keeping the pointer down to drag it. */
async function pickUp(page: Page, coin: Locator) {
  const p = await center(coin.locator('.orb'))
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(700)
  await expect(page.locator('.board.editing')).toBeVisible()
  return p
}

async function glide(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 20, from.y + ((to.y - from.y) * i) / 20)
    await page.waitForTimeout(16)
  }
}

/** Keeps the pointer around a point, as a finger does, until `ms` have passed since `since`. */
async function hold(page: Page, at: { x: number; y: number }, ms: number, since = Date.now()) {
  for (let i = 0; Date.now() - since < ms; i++) {
    await page.mouse.move(at.x + (i % 2), at.y)
    await page.waitForTimeout(40)
  }
}

const names = (section: Locator) => section.locator('[data-entity-id] .coin-name').allTextContents()

test('a coin held over the corner coin of a row stays put and lands there', async ({ board: page }) => {
  const accounts = page.locator('.section').nth(1)
  const pager = accounts.locator('.pager')
  const before = await names(accounts)
  const corner = accounts.locator('[data-entity-id]').nth(3) // last column of the first page

  const from = await pickUp(page, accounts.locator('[data-entity-id]').first())
  // aim at the outer part of the corner coin, close to the screen edge
  const box = (await corner.boundingBox())!
  const at = { x: box.x + box.width - 10, y: from.y }
  await glide(page, from, at)
  await hold(page, at, 1500)
  expect(await pager.evaluate((e) => e.scrollLeft), 'the page flipped under the finger').toBe(0)
  await page.mouse.up()

  await expect.poll(() => names(accounts)).toEqual([...before.slice(1, 4), before[0], ...before.slice(4)])

  // put it back in front for the other tests
  await page.waitForTimeout(400)
  const back = await center(accounts.locator('[data-entity-id]').nth(3).locator('.orb'))
  await page.mouse.move(back.x, back.y)
  await page.mouse.down()
  await glide(page, back, await center(accounts.locator('[data-entity-id]').first().locator('.orb')))
  await page.mouse.up()
  await expect.poll(() => names(accounts)).toEqual(before)
})

// The bug: the coins made room the moment the finger touched a slot, so a coin carried
// across the grid set every coin it passed over moving.
test('coins stay put while a held coin passes over them', async ({ board: page }) => {
  const accounts = page.locator('.section').nth(1)
  const coins = accounts.locator('[data-entity-id]')
  const before = await names(accounts)
  const target = await center(coins.nth(2).locator('.orb'))
  const from = await pickUp(page, coins.first())
  // count every change of order while the coin is carried across
  await accounts.locator('.pager').evaluate((el) => {
    const w = window as unknown as { reorders: number }
    w.reorders = 0
    new MutationObserver(() => w.reorders++).observe(el, { childList: true })
  })
  await page.mouse.move(target.x, target.y, { steps: 6 })
  expect(await page.evaluate(() => (window as unknown as { reorders: number }).reorders), 'moved on the way').toBe(0)
  await hold(page, target, 600)
  // the coin took the slot it rests over, in one move
  expect(await names(accounts)).toEqual([before[1], before[2], before[0], ...before.slice(3)])
  expect(await page.evaluate(() => (window as unknown as { reorders: number }).reorders)).toBe(1)
  await page.mouse.up()

  // put it back: a release over a slot takes it at once
  await page.waitForTimeout(400)
  const back = await center(coins.nth(2).locator('.orb'))
  await page.mouse.move(back.x, back.y)
  await page.mouse.down()
  await page.mouse.move(from.x, from.y, { steps: 4 })
  await page.mouse.up()
  await expect.poll(() => names(accounts)).toEqual(before)
})

test('the very screen edge still flips to the next page, after a moment', async ({ board: page }) => {
  const accounts = page.locator('.section').nth(1)
  const pager = accounts.locator('.pager')
  const before = await names(accounts)
  const from = await pickUp(page, accounts.locator('[data-entity-id]').nth(3))
  const edge = { x: page.viewportSize()!.width - 4, y: from.y }
  const width = await pager.evaluate((e) => e.clientWidth)
  await page.mouse.move(edge.x, edge.y)
  const since = Date.now()
  await hold(page, edge, 400, since)
  expect(await pager.evaluate((e) => e.scrollLeft), 'flipped without a dwell').toBe(0)
  // one flip, to exactly the next page
  await hold(page, edge, 1300, since)
  await expect.poll(() => pager.evaluate((e) => e.scrollLeft)).toBeCloseTo(width, -1)
  // released over the gutter: nothing moves
  await page.mouse.up()
  await page.getByRole('button', { name: 'Готово' }).click()
  expect(await names(accounts)).toEqual(before)
})

test('the empty cells after the last coin take a coin to the end', async ({ board: page }) => {
  const expenses = page.locator('.expenses')
  const pager = expenses.locator('.pager')
  const before = await names(expenses)
  const coins = expenses.locator('[data-entity-id]')
  const last0 = (await coins.last().boundingBox())!
  test.skip(last0.x + last0.width > (await pager.boundingBox())!.width, 'the last coin is on another page')
  const from = await pickUp(page, coins.nth(before.length - 2))
  // in edit mode the "+" tile is hidden: the last row has free cells
  const last = (await coins.last().boundingBox())!
  const free = { x: Math.min(last.x + last.width * 1.5, page.viewportSize()!.width - 40), y: last.y + 30 }
  test.skip(free.x <= last.x + last.width, 'the last coin ends the row')
  // around the last coin, not over it: below the row, then up into the free cell
  const pagerBottom = (await pager.boundingBox())!
  const below = Math.min(last.y + last.height + 8, pagerBottom.y + pagerBottom.height - 2)
  await glide(page, from, { x: from.x, y: below })
  await glide(page, { x: from.x, y: below }, { x: free.x, y: below })
  await glide(page, { x: free.x, y: below }, free)
  await page.mouse.up()
  await expect.poll(() => names(expenses)).toEqual([...before.slice(0, -2), before.at(-1)!, before.at(-2)!])
})

// The bug: a finger wandering over the coins in edit mode set them all jumping. Coins
// gliding to their new places were taken for targets as they slid under the finger.
test('a finger wandering in edit mode moves only the held coin, to the slot under it', async ({ board: page }) => {
  const expenses = page.locator('.expenses')
  const coins = expenses.locator('[data-entity-id]')
  const before = await names(expenses)
  test.skip(before.length < 8, 'needs two rows of coins')
  const slots = await Promise.all([1, 6, 2, 5, 7, 3].map((i) => center(coins.nth(i).locator('.orb'))))
  const from = await pickUp(page, coins.first())
  let at = from
  for (const p of slots) {
    await glide(page, at, p)
    at = p
  }
  // held still over one slot: the order settles with the coin there and stays
  await hold(page, at, 900)
  const settled = await names(expenses)
  await hold(page, at, 600)
  expect(await names(expenses)).toEqual(settled)
  await page.mouse.up()
  const moved = [...before.slice(1, 4), before[0], ...before.slice(4)]
  await expect.poll(() => names(expenses)).toEqual(moved)

  // put it back for the other tests
  await page.waitForTimeout(400)
  const back = await center(coins.nth(3).locator('.orb'))
  await page.mouse.move(back.x, back.y)
  await page.mouse.down()
  await glide(page, back, await center(coins.first().locator('.orb')))
  await page.mouse.up()
  await expect.poll(() => names(expenses)).toEqual(before)
})
