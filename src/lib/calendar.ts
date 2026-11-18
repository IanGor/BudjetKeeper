/** Monday-first calendar. Native date inputs follow the browser locale and often open on Sunday. */

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const

export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'] as const

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'] as const

export interface CalendarCell {
  iso: string
  day: number
  inMonth: boolean
}

export function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function parseISODate(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return { y, m, d }
}

/** Monday = 0 … Sunday = 6. JS getDay() is Sunday = 0, so shift it. */
export function mondayIndex(y: number, m: number, d: number): number {
  return (new Date(y, m - 1, d).getDay() + 6) % 7
}

/** Six weeks, each starting on Monday. Cells outside `m` belong to the neighbour months. */
export function monthGrid(y: number, m: number): CalendarCell[] {
  const lead = mondayIndex(y, m, 1)
  const start = new Date(y, m - 1, 1 - lead)
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return {
      iso: isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate()),
      day: date.getDate(),
      inMonth: date.getMonth() === m - 1,
    }
  })
}

export function shiftDays(iso: string, days: number): string {
  const parsed = parseISODate(iso)
  if (!parsed) return iso
  const date = new Date(parsed.y, parsed.m - 1, parsed.d + days)
  return isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export function formatDateShort(iso: string): string {
  const parsed = parseISODate(iso)
  if (!parsed) return iso
  return `${String(parsed.d).padStart(2, '0')}.${String(parsed.m).padStart(2, '0')}.${parsed.y}`
}

export function formatDateRu(iso: string): string {
  const parsed = parseISODate(iso)
  if (!parsed) return iso
  return `${parsed.d} ${MONTHS_GEN[parsed.m - 1]} ${parsed.y}`
}
