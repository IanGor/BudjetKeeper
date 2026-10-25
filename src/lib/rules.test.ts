import { describe, expect, it } from 'vitest'
import { canDragFrom, canFlow, flowLabel, planFill } from './rules'
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

describe('planFill', () => {
  it('is empty with nothing spent, even after refunds', () => {
    expect(planFill(0, 1000)).toEqual({ fill: 0, over: false })
    expect(planFill(-500, 1000)).toEqual({ fill: 0, over: false })
    expect(planFill(0, null)).toEqual({ fill: 0, over: false })
  })

  it('fills in proportion to the plan and is full exactly at the plan', () => {
    expect(planFill(250, 1000)).toEqual({ fill: 0.25, over: false })
    expect(planFill(1000, 1000)).toEqual({ fill: 1, over: false })
  })

  it('stays full and marks spending beyond the plan', () => {
    expect(planFill(1001, 1000)).toEqual({ fill: 1, over: true })
  })

  it('without a plan any spending fills it, nothing is "over"', () => {
    expect(planFill(1, null)).toEqual({ fill: 1, over: false })
    expect(planFill(1, 0)).toEqual({ fill: 1, over: false })
  })
})
