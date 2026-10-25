const NBSP = ' '

function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

/** 1234550 -> "12 345,50 ₽"; kopecks are shown only when non-zero. */
export function formatRub(kopecks: number, withSign = false): string {
  const sign = kopecks < 0 ? '−' : withSign && kopecks > 0 ? '+' : ''
  const abs = Math.abs(Math.round(kopecks))
  const rub = Math.floor(abs / 100)
  const kop = abs % 100
  const tail = kop ? ',' + String(kop).padStart(2, '0') : ''
  return `${sign}${groupThousands(rub)}${tail}${NBSP}₽`
}

/** Largest amount of an account, a category or a single operation: 99 999 999 ₽. */
export const MAX_KOPECKS = 99_999_999_00
/** Narrow no-break space: digit groups stay readable but take a third less width. */
const NNBSP = '\u202f'

/**
 * Coin captions: whole rubles with every digit, no ₽ (the only currency) and no
 * "тыс"/"млн", so amounts compare at a glance. "−99 999 999" fits a coin column.
 */
export function formatRubWhole(kopecks: number): string {
  const rub = Math.round(kopecks / 100)
  const sign = rub < 0 ? '−' : ''
  return sign + String(Math.abs(rub)).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP)
}

/** "1 234,5" -> 123450; null when not a valid non-negative amount up to MAX_KOPECKS. */
export function parseRub(input: string): number | null {
  const s = input.replace(/[\s\u00a0\u202f₽]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null
  const kopecks = Math.round(parseFloat(s) * 100)
  return kopecks <= MAX_KOPECKS ? kopecks : null
}

export const OPERATORS = ['+', '−', '×', '÷'] as const
export type Operator = (typeof OPERATORS)[number]

/**
 * Evaluates a calculator expression like "120+35,5×2" (operators + − × ÷,
 * decimal comma or dot) with normal precedence. Returns kopecks, or null
 * for an empty/invalid expression or division by zero.
 */
export function evalExpression(expr: string): number | null {
  const tokens = expr
    .replace(/\s/g, '')
    .replace(/-/g, '−')
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .match(/\d+(?:[.,]\d*)?|[+−×÷]|./g)
  if (!tokens) return null

  // trailing operator while typing ("120+") is ignored
  if ((OPERATORS as readonly string[]).includes(tokens[tokens.length - 1])) tokens.pop()
  if (tokens.length === 0 || tokens.length % 2 === 0) return null

  const terms: number[] = []
  let ops: Operator[] = []
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (i % 2 === 0) {
      if (!/^\d+(?:[.,]\d*)?$/.test(tok)) return null
      terms.push(parseFloat(tok.replace(',', '.')))
    } else {
      if (!(OPERATORS as readonly string[]).includes(tok)) return null
      ops.push(tok as Operator)
    }
  }

  // first pass: × and ÷
  const sums: number[] = [terms[0]]
  const addOps: Operator[] = []
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    const rhs = terms[i + 1]
    if (op === '×') sums[sums.length - 1] *= rhs
    else if (op === '÷') {
      if (rhs === 0) return null
      sums[sums.length - 1] /= rhs
    } else {
      addOps.push(op)
      sums.push(rhs)
    }
  }
  ops = addOps

  let result = sums[0]
  for (let i = 0; i < ops.length; i++) {
    result = ops[i] === '+' ? result + sums[i + 1] : result - sums[i + 1]
  }
  if (!Number.isFinite(result)) return null
  return Math.round(result * 100)
}
