import { describe, expect, it } from 'vitest'
import { adjustmentFor, applyTransaction, inMonth, monthStart, msToNextMonth, todayISO } from './totals'
import type { Entity, EntityKind } from './types'

const ent = (id: string, kind: EntityKind) => ({ id, kind }) as Entity
const entities = {
  salary: ent('salary', 'income'),
  card: ent('card', 'account'),
  cash: ent('cash', 'account'),
  food: ent('food', 'expense'),
}
const month = '2026-10-01'

describe('date helpers', () => {
  it('formats month start and today', () => {
    const d = new Date(2026, 0, 7)
    expect(monthStart(d)).toBe('2026-01-01')
    expect(todayISO(d)).toBe('2026-01-07')
  })
  it('checks month membership', () => {
    expect(inMonth('2026-10-31', month)).toBe(true)
    expect(inMonth('2026-09-30', month)).toBe(false)
  })
})

describe('msToNextMonth', () => {
  it('counts to 00:00 of the 1st, local time', () => {
    expect(msToNextMonth(new Date(2026, 9, 31, 23, 59, 50))).toBe(10_000)
    expect(msToNextMonth(new Date(2026, 9, 1, 0, 0, 0))).toBe(new Date(2026, 10, 1).getTime() - new Date(2026, 9, 1).getTime())
  })
  it('crosses the year', () => {
    expect(msToNextMonth(new Date(2026, 11, 31, 23, 0))).toBe(60 * 60 * 1000)
  })
  it('a second after midnight is already the new month', () => {
    const d = new Date(2026, 10, 1, 0, 0, 1)
    expect(monthStart(d)).toBe('2026-11-01')
    expect(msToNextMonth(d)).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)
  })
})

describe('applyTransaction', () => {
  it('income adds to source and account', () => {
    const t = applyTransaction({}, entities, { from_id: 'salary', to_id: 'card', amount_kopecks: 5000, occurred_at: '2026-10-05' }, month)
    expect(t).toEqual({ salary: 5000, card: 5000 })
  })
  it('expense moves money from account to category', () => {
    const t = applyTransaction({ card: 5000 }, entities, { from_id: 'card', to_id: 'food', amount_kopecks: 1200, occurred_at: '2026-10-05' }, month)
    expect(t).toEqual({ card: 3800, food: 1200 })
  })
  it('transfer moves between accounts', () => {
    const t = applyTransaction({ card: 5000 }, entities, { from_id: 'card', to_id: 'cash', amount_kopecks: 1000, occurred_at: '2026-10-05' }, month)
    expect(t).toEqual({ card: 4000, cash: 1000 })
  })
  it('other months change only account balances', () => {
    const t = applyTransaction({}, entities, { from_id: 'card', to_id: 'food', amount_kopecks: 700, occurred_at: '2026-09-30' }, month)
    expect(t).toEqual({ card: -700 })
  })
  it('balance adjustment changes only the account', () => {
    const up = applyTransaction({ card: 1000 }, entities, { from_id: null, to_id: 'card', amount_kopecks: 250, occurred_at: '2026-10-05' }, month)
    expect(up).toEqual({ card: 1250 })
    const down = applyTransaction(up, entities, { from_id: 'card', to_id: null, amount_kopecks: 1250, occurred_at: '2026-10-05' }, month)
    expect(down).toEqual({ card: 0 })
  })
  it('sign -1 reverts', () => {
    const tx = { from_id: 'card', to_id: 'food', amount_kopecks: 700, occurred_at: '2026-10-01' }
    const t = applyTransaction(applyTransaction({ card: 1000 }, entities, tx, month), entities, tx, month, -1)
    expect(t).toEqual({ card: 1000, food: 0 })
  })
})

describe('adjustmentFor', () => {
  it('records the difference on the right side', () => {
    expect(adjustmentFor('card', 1000, 1500)).toEqual({ from_id: null, to_id: 'card', amount_kopecks: 500 })
    expect(adjustmentFor('card', 1000, 0)).toEqual({ from_id: 'card', to_id: null, amount_kopecks: 1000 })
    expect(adjustmentFor('card', -300, 0)).toEqual({ from_id: null, to_id: 'card', amount_kopecks: 300 })
  })
  it('returns null when the balance is unchanged', () => {
    expect(adjustmentFor('card', 700, 700)).toBeNull()
  })
})
