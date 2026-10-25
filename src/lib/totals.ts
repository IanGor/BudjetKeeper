import type { Entity, Transaction } from './types'

export type Totals = Record<string, number>

/** First day of the month containing `d`, as YYYY-MM-01. */
export function monthStart(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/** Milliseconds from `now` to 00:00 of the 1st of the next month, local time. */
export function msToNextMonth(now: Date = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - now.getTime()
}

export function todayISO(d: Date = new Date()): string {
  return `${monthStart(d).slice(0, 8)}${String(d.getDate()).padStart(2, '0')}`
}

export function inMonth(date: string, month: string): boolean {
  return date.slice(0, 7) === month.slice(0, 7)
}

/**
 * Applies a transaction to totals the same way public.entity_totals() computes them:
 * accounts hold an all-time balance, income sources and categories a monthly sum.
 * `sign` = -1 reverts a transaction (used for optimistic rollback and edits).
 */
export function applyTransaction(
  totals: Totals,
  entities: Record<string, Entity>,
  tx: Pick<Transaction, 'from_id' | 'to_id' | 'amount_kopecks' | 'occurred_at'>,
  month: string,
  sign: 1 | -1 = 1,
): Totals {
  const next = { ...totals }
  const amount = tx.amount_kopecks * sign
  const monthly = inMonth(tx.occurred_at, month)
  // one side is null for a balance adjustment
  const from = tx.from_id ? entities[tx.from_id] : undefined
  const to = tx.to_id ? entities[tx.to_id] : undefined

  if (from?.kind === 'account') next[from.id] = (next[from.id] ?? 0) - amount
  else if (from?.kind === 'income' && monthly) next[from.id] = (next[from.id] ?? 0) + amount

  if (to?.kind === 'account') next[to.id] = (next[to.id] ?? 0) + amount
  else if (to?.kind === 'expense' && monthly) next[to.id] = (next[to.id] ?? 0) + amount

  return next
}

/**
 * One-sided transaction that moves an account from `current` to `target` balance
 * (see the balance_adjustment migration); null when nothing changes.
 */
export function adjustmentFor(
  accountId: string,
  current: number,
  target: number,
): Pick<Transaction, 'from_id' | 'to_id' | 'amount_kopecks'> | null {
  const diff = target - current
  if (diff === 0) return null
  return diff > 0
    ? { from_id: null, to_id: accountId, amount_kopecks: diff }
    : { from_id: accountId, to_id: null, amount_kopecks: -diff }
}
