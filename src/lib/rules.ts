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
