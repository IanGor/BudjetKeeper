import type { Entity, Transaction } from './types'

type DayRow = Pick<Transaction, 'occurred_at' | 'amount_kopecks'>
type Flow = Pick<Transaction, 'from_id' | 'to_id'>

export function transactionDirection(
  tx: Flow,
  entities: Record<string, Pick<Entity, 'kind'>>,
  entity?: Pick<Entity, 'id' | 'kind'>,
): -1 | 0 | 1 {
  if (entity) return entity.kind === 'income' || (entity.kind === 'account' && tx.to_id === entity.id) ? 1 : -1
  if (tx.from_id && entities[tx.from_id]?.kind === 'income') return 1
  if (tx.to_id && entities[tx.to_id]?.kind === 'expense') return -1
  // Transfers and balance corrections have no income/expense sign in the feed.
  return 0
}

/** Both histories are already ordered by operation date, then by creation time. */
export function groupTransactionDays<T extends DayRow>(rows: readonly T[], direction: (row: T) => number) {
  const days: { day: string; items: T[]; total: number }[] = []
  for (const row of rows) {
    let current = days.at(-1)
    if (current?.day !== row.occurred_at) {
      current = { day: row.occurred_at, items: [], total: 0 }
      days.push(current)
    }
    current.items.push(row)
    current.total += row.amount_kopecks * direction(row)
  }
  return days
}

/** Read at least `limit` rows, finishing the boundary day before returning it. */
export async function readThroughDay<T extends Pick<Transaction, 'occurred_at'>>(
  offset: number,
  limit: number,
  fetch: (offset: number, size: number) => Promise<T[] | null>,
): Promise<{ rows: T[]; hasMore: boolean } | null> {
  const rows: T[] = []
  let size = Math.min(limit + 1, 100)
  for (;;) {
    const batch = await fetch(offset + rows.length, size)
    if (!batch) return null
    for (const row of batch) {
      if (rows.length >= limit && rows.at(-1)?.occurred_at !== row.occurred_at) return { rows, hasMore: true }
      rows.push(row)
    }
    if (batch.length < size) return { rows, hasMore: false }
    size = Math.min(Math.max(limit - rows.length + 1, 40), 100)
  }
}
