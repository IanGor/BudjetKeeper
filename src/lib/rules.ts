import type { Entity, EntityKind, RoundupSettings } from './types'

// Mirrors public.check_transaction() in the init migration.
export function canFlow(from: EntityKind, to: EntityKind): boolean {
  if (from === 'income') return to === 'account'
  if (from === 'account') return to === 'account' || to === 'expense'
  return false
}

export function canDragFrom(kind: EntityKind): boolean {
  return kind !== 'expense'
}

export function flowLabel(from: EntityKind, to: EntityKind): string {
  if (from === 'income') return 'Доход'
  if (to === 'account') return 'Перевод'
  return 'Расход'
}

/**
 * How full a category's icon is drawn: 0 with nothing spent, 1 when the
 * spending reaches the plan. Without a plan any spending fills it.
 * `over` marks spending beyond the plan.
 */
export function planFill(spent: number, plan: number | null): { fill: number; over: boolean } {
  if (spent <= 0) return { fill: 0, over: false }
  if (plan == null || plan <= 0) return { fill: 1, over: false }
  return { fill: Math.min(spent / plan, 1), over: spent > plan }
}

/** The default step of round-ups: 10 ₽, as the bank does. */
export const ROUNDUP_STEP = 10_00

/** What a spending of `amount` kopecks adds when rounded up to the step: 35 ₽ → 5 ₽, 12 320 ₽ → 0. */
export function roundUpExtra(amount: number, step = ROUNDUP_STEP): number {
  if (amount <= 0) return 0
  return Math.ceil(amount / step) * step - amount
}

/**
 * Whether a spending from `from` to the category `to` is rounded up. Transfers and
 * income are never rounded, nor is spending from the round-up account or from an
 * account the settings leave out.
 */
export function roundupApplies(s: RoundupSettings, from: Entity, to: Entity): boolean {
  if (s.roundup_account_id === null || from.kind !== 'account' || to.kind !== 'expense') return false
  return from.id !== s.roundup_account_id && !s.roundup_skip_from.includes(from.id)
}
