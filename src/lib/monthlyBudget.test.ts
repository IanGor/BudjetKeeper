import { describe, expect, it } from 'vitest'
import { distributionSummary, nextMonth, withMonthlyLimits } from './monthlyBudget'
import type { Entity } from './types'
const entity = (id: string, in_balance = true): Entity => ({ id, in_balance, kind: 'account', household_id: 'h', name: id, icon: 'wallet', color: '#fff', plan_kopecks: null, archived: false, position: 0, created_at: '' })
const entities = { source: entity('source'), regular: entity('regular'), savings: entity('savings', false) }
describe('monthly planning', () => {
  it('handles the calendar year boundary', () => expect(nextMonth('2026-12-01')).toBe('2027-01-01'))
  it('includes the remainder of an included source but excludes transfers to savings', () => {
    expect(distributionSummary(entities.source, 10000, { regular: 3000, savings: 2000 }, entities))
      .toEqual({ allocated: 5000, remainder: 5000, available: 8000 })
  })
  it('includes only new money transferred to included recipients from an excluded source', () => {
    expect(distributionSummary(entity('source', false), 10000, { regular: 3000, savings: 2000 }, entities).available).toBe(3000)
  })
  it('detects over-allocation and supports keeping all money on the source', () => {
    expect(distributionSummary(entities.source, 100, { regular: 101 }, entities).remainder).toBe(-1)
    expect(distributionSummary(entities.source, 100, {}, entities).available).toBe(100)
  })
  it('applies explicit zero and null limits without changing the fallback or account plans', () => {
    const expense = { ...entity('expense'), kind: 'expense' as const, plan_kopecks: 10000 }
    const input = { expense, source: entities.source }
    expect(withMonthlyLimits(input, { expense: 0 }).expense.plan_kopecks).toBe(0)
    expect(withMonthlyLimits(input, { expense: null }).expense.plan_kopecks).toBeNull()
    expect(withMonthlyLimits(input, {}).expense.plan_kopecks).toBe(10000)
    expect(withMonthlyLimits(input, { source: 500 }).source.plan_kopecks).toBeNull()
    expect(input.expense.plan_kopecks).toBe(10000)
  })
})
