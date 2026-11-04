import type { Entity } from './types'
import { monthStart } from './totals'

export interface Distribution {
  id: string
  month: string
  source_id: string
  available_kopecks: number
}
export interface MonthlyBudget {
  current_limits: Record<string, number | null>
  next_limits: Record<string, number | null>
  saved_at: string | null
  distribution: Distribution | null
}
export const emptyMonthlyBudget = (): MonthlyBudget => ({ current_limits: {}, next_limits: {}, saved_at: null, distribution: null })

export function nextMonth(month = monthStart()): string {
  return monthStart(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1))
}
export function monthLabel(month: string): string {
  return new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
    .toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}
export function withMonthlyLimits(entities: Record<string, Entity>, limits: MonthlyBudget['current_limits']): Record<string, Entity> {
  return Object.fromEntries(Object.values(entities).map((e) => [e.id,
    e.kind === 'expense' && Object.hasOwn(limits, e.id) ? { ...e, plan_kopecks: limits[e.id] } : e,
  ]))
}
export function distributionSummary(source: Entity | undefined, balance: number, allocations: Record<string, number>, entities: Record<string, Entity>) {
  const allocated = Object.values(allocations).reduce((sum, value) => sum + value, 0)
  const remainder = balance - allocated
  const available = (source?.in_balance !== false ? remainder : 0) + Object.entries(allocations)
    .reduce((sum, [id, value]) => sum + (entities[id]?.in_balance !== false ? value : 0), 0)
  return { allocated, remainder, available }
}

/** Integration point for an analytics collector; no collector is configured in this app. */
export function budgetEvent(name: 'distribution_started' | 'distribution_confirmed' | 'monthly_plan_saved', detail: Record<string, string | number | boolean>) {
  window.dispatchEvent(new CustomEvent('budget:analytics', { detail: { name, ...detail } }))
}
