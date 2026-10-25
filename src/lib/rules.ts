import type { EntityKind } from './types'

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
