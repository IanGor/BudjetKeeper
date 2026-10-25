import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// A category icon is a neutral disc that fills with its color as the plan is spent;
// the amount turns bright red once spending goes beyond the plan.

function category(page: Page, name: string) {
  const coin = page.locator('.expenses [data-entity-id]', { hasText: name })
  return coin.evaluate((el) => {
    const orb = el.querySelector<HTMLElement>('.orb')!
    const fill = el.querySelector<HTMLElement>('.orb-fill')!
    const amount = el.querySelector<HTMLElement>('.coin-amount')!
    // resolve a color token to rgb() the way the browser reports computed colors
    const probe = document.createElement('span')
    document.body.append(probe)
    const token = (v: string) => {
      probe.style.color = getComputedStyle(document.documentElement).getPropertyValue(v).trim()
      return getComputedStyle(probe).color
    }
    const result = {
      fill: Number(getComputedStyle(orb).getPropertyValue('--fill')),
      background: getComputedStyle(orb).backgroundColor,
      fillColor: getComputedStyle(fill).backgroundColor,
      amountColor: getComputedStyle(amount).color,
      empty: token('--orb-empty'),
      ink: token('--ink'),
      over: token('--over'),
    }
    probe.remove()
    return result
  })
}

test('nothing spent: a neutral disc, the amount in ink', async ({ board: page }) => {
  const c = await category(page, 'Развлечения') // nothing spent; no other test touches it
  expect(c.fill).toBe(0)
  expect(c.background).toBe(c.empty)
  expect(c.amountColor).toBe(c.ink)
})

test('partly spent: filled in proportion to the plan', async ({ board: page }) => {
  const c = await category(page, 'Продукты') // 45 230 of 70 000
  expect(c.fill).toBeCloseTo(45230 / 70000, 3)
  expect(c.background).toBe(c.empty)
  expect(c.fillColor).toBe('rgb(76, 184, 96)') // its own color #4cb860
  expect(c.amountColor).toBe(c.ink)
})

test('spent exactly the plan: full, not over', async ({ board: page }) => {
  const c = await category(page, 'Аренда') // 80 000 of 80 000
  expect(c.fill).toBe(1)
  expect(c.amountColor).toBe(c.ink)
})

test('over the plan: full and the amount turns bright', async ({ board: page }) => {
  const c = await category(page, 'Еда в городе') // 27 500 of 25 000
  expect(c.fill).toBe(1)
  expect(c.amountColor).toBe(c.over)
  expect(c.amountColor).not.toBe(c.ink)
})
