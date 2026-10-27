import { describe, expect, it } from 'vitest'
import { canDragFrom, canFlow, flowLabel, planFill, roundupApplies, roundUpExtra } from './rules'
import type { Entity, EntityKind, RoundupSettings } from './types'

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

describe('roundUpExtra', () => {
  it('rounds a spending up to 10 ₽, as the bank does', () => {
    expect(roundUpExtra(35_00)).toBe(5_00)
    expect(roundUpExtra(1_433_00)).toBe(7_00)
    expect(roundUpExtra(12_320_00)).toBe(0)
  })
  it('counts kopecks too', () => {
    expect(roundUpExtra(35_50)).toBe(4_50)
    expect(roundUpExtra(10_01)).toBe(9_99)
  })
  it('adds nothing to nothing', () => {
    expect(roundUpExtra(0)).toBe(0)
  })
})

describe('roundupApplies', () => {
  const e = (id: string, kind: EntityKind) => ({ id, kind }) as Entity
  const base: RoundupSettings = { roundup_account_id: 'save', roundup_step: 1000, roundup_skip_from: [], roundup_skip_to: [] }
  const card = e('card', 'account')
  const food = e('food', 'expense')

  it('rounds only spending from an account to a category, for every pair of kinds', () => {
    const made = kinds.flatMap((f) => kinds.filter((t) => roundupApplies(base, e('a', f), e('b', t))).map((t) => `${f}→${t}`))
    expect(made).toEqual(['account→expense'])
  })
  it('is off without a round-up account and for the round-up account itself', () => {
    expect(roundupApplies({ ...base, roundup_account_id: null }, card, food)).toBe(false)
    expect(roundupApplies(base, e('save', 'account'), food)).toBe(false)
  })
  it('skips listed source accounts', () => {
    const s = { ...base, roundup_skip_from: ['card'] }
    expect(roundupApplies(s, card, food)).toBe(false)
    expect(roundupApplies(s, e('cash', 'account'), food)).toBe(true)
  })
  it('skips listed categories', () => {
    const s = { ...base, roundup_skip_to: ['rent'] }
    expect(roundupApplies(s, card, e('rent', 'expense'))).toBe(false)
    expect(roundupApplies(s, card, food)).toBe(true)
  })
})
