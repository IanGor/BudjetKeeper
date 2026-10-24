import { describe, expect, it } from 'vitest'
import { canDragFrom, canFlow, flowLabel } from './rules'
import type { EntityKind } from './types'

const kinds: EntityKind[] = ['income', 'account', 'expense']

describe('canFlow', () => {
  it('allows only income→account, account→account, account→expense', () => {
    const allowed = kinds.flatMap((f) => kinds.filter((t) => canFlow(f, t)).map((t) => `${f}→${t}`))
    expect(allowed.sort()).toEqual(['account→account', 'account→expense', 'income→account'])
  })
})

describe('canDragFrom', () => {
  it('expense categories are drop targets only', () => {
    expect(canDragFrom('income')).toBe(true)
    expect(canDragFrom('account')).toBe(true)
    expect(canDragFrom('expense')).toBe(false)
  })
})

describe('flowLabel', () => {
  it('names the operation', () => {
    expect(flowLabel('income', 'account')).toBe('Доход')
    expect(flowLabel('account', 'account')).toBe('Перевод')
    expect(flowLabel('account', 'expense')).toBe('Расход')
  })
})
