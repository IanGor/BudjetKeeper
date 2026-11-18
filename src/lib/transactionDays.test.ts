import { describe, expect, it } from 'vitest'
import { groupTransactionDays, readThroughDay, transactionDirection } from './transactionDays'

const first = '2026-11-16'
const second = '2026-11-15'
const third = '2026-11-14'
const tx = (day: string, amount: number, from_id: string | null = 'account', to_id: string | null = 'expense') => ({ occurred_at: day, amount_kopecks: amount, from_id, to_id })
const entities = { source: { kind: 'income' }, account: { kind: 'account' }, savings: { kind: 'account' }, expense: { kind: 'expense' } } as const

describe('daily transaction totals', () => {
  it('totals only spending and keeps transfers, top-ups and adjustments in the list', () => {
    const spending = [tx(first, 1234), tx(first, 56)]
    const other = [
      tx(first, 567, 'source', 'account'),
      tx(first, 9987, 'account', 'savings'),
      tx(first, 4500, null, 'account'),
      tx(first, 1000, 'account', null),
      tx(second, 100, 'account', 'savings'),
    ]
    const rows = [...spending, ...other]
    expect(groupTransactionDays(rows, entities)).toEqual([
      { day: first, items: rows.slice(0, -1), total: -1290 },
      { day: second, items: rows.slice(-1), total: 0 },
    ])
    expect(groupTransactionDays(spending, entities)).toEqual([
      { day: first, items: spending, total: -1290 },
    ])
  })

  it('counts a transfer out of one account and into the other in their own histories', () => {
    const transfer = tx(first, 4321, 'account', 'savings')
    expect(transactionDirection(transfer, entities, { id: 'account', kind: 'account' })).toBe(-1)
    expect(transactionDirection(transfer, entities, { id: 'savings', kind: 'account' })).toBe(1)
  })
})

describe('readThroughDay', () => {
  it('finishes the last day even when it spans multiple batches and leaves the older day for the next page', async () => {
    const rows = [tx(first, 1), ...Array.from({ length: 205 }, () => tx(second, 2)), tx(third, 3)]
    const fetch = async (offset: number, size: number) => rows.slice(offset, offset + size)
    const page = await readThroughDay(0, 2, fetch)
    expect(page).toEqual({ rows: rows.slice(0, -1), hasMore: true })
    await expect(readThroughDay(page!.rows.length, 2, fetch)).resolves.toEqual({ rows: rows.slice(-1), hasMore: false })
  })

  it('does not return a partial day if loading its remainder fails', async () => {
    const rows = Array.from({ length: 250 }, () => tx(first, 1))
    await expect(readThroughDay(0, 2, async (offset, size) => offset ? null : rows.slice(0, size))).resolves.toBeNull()
  })
})
