import { MAX_KOPECKS, OPERATORS } from './money'

export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back' | (typeof OPERATORS)[number]

const MAX_LENGTH = 32
/** digits before the point: 99 999 999 ₽ is the largest amount */
const MAX_RUB_DIGITS = String(MAX_KOPECKS / 100).length
const isOp = (ch: string | undefined) => ch !== undefined && (OPERATORS as readonly string[]).includes(ch)

/** Applies one calculator key press to the expression string. */
export function pressKey(expr: string, key: Key): string {
  if (key === 'back') return expr.slice(0, -1)

  const last = expr[expr.length - 1]
  const lastOp = Math.max(...OPERATORS.map((op) => expr.lastIndexOf(op)))
  const current = expr.slice(lastOp + 1)

  if (isOp(key)) {
    if (expr === '') return expr
    if (isOp(last)) return expr.slice(0, -1) + key
    if (last === '.') return expr.slice(0, -1) + key
    return expr.length >= MAX_LENGTH ? expr : expr + key
  }

  if (expr.length >= MAX_LENGTH) return expr

  if (key === '.') {
    if (current.includes('.')) return expr
    return expr + (current === '' ? '0.' : '.')
  }

  // digit
  const point = current.indexOf('.')
  if (point >= 0 && current.length - point > 2) return expr
  if (current === '0') return expr.slice(0, -1) + key
  if (point < 0 && current.length >= MAX_RUB_DIGITS) return expr
  return expr + key
}

/** 123450 -> "1234.5" for pre-filling the calculator. */
export function kopecksToInput(kopecks: number): string {
  const rub = Math.floor(kopecks / 100)
  const kop = kopecks % 100
  if (!kop) return String(rub)
  return `${rub}.${String(kop).padStart(2, '0').replace(/0$/, '')}`
}

export function hasOperator(expr: string): boolean {
  return [...expr].some(isOp)
}
