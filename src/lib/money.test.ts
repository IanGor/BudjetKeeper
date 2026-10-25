import { describe, expect, it } from 'vitest'
import { evalExpression, formatAmount, formatRub, MAX_KOPECKS, parseRub } from './money'

const n = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')

describe('formatRub', () => {
  it('groups thousands and hides zero kopecks', () => {
    expect(n(formatRub(123456700))).toBe('1 234 567 ₽')
    expect(n(formatRub(0))).toBe('0 ₽')
  })
  it('shows kopecks after a point', () => {
    expect(n(formatRub(1234550))).toBe('12 345.50 ₽')
    expect(n(formatRub(5))).toBe('0.05 ₽')
  })
  it('prints sign', () => {
    expect(n(formatRub(-15000))).toBe('−150 ₽')
    expect(n(formatRub(15000, true))).toBe('+150 ₽')
  })
})

describe('formatAmount', () => {
  it('prints every digit, without units', () => {
    expect(n(formatAmount(0))).toBe('0')
    expect(n(formatAmount(2_222_100))).toBe('22 221')
    expect(n(formatAmount(MAX_KOPECKS))).toBe('99 999 999')
    expect(n(formatAmount(-MAX_KOPECKS))).toBe('−99 999 999')
  })
  it('keeps kopecks instead of rounding to rubles', () => {
    expect(n(formatAmount(12_345_650))).toBe('123 456.50')
    expect(n(formatAmount(-50_001))).toBe('−500.01')
    expect(n(formatAmount(35_955_768))).toBe('359 557.68')
  })
  it('groups with narrow no-break spaces so the number never wraps', () => {
    expect(formatAmount(123_456_700)).toBe('1\u202f234\u202f567')
  })
})

describe('parseRub', () => {
  it('parses rubles to kopecks', () => {
    expect(parseRub('1 234,5')).toBe(123450)
    expect(parseRub('10.05')).toBe(1005)
    expect(parseRub('7')).toBe(700)
  })
  it('rejects garbage', () => {
    expect(parseRub('')).toBeNull()
    expect(parseRub('1,234')).toBeNull()
    expect(parseRub('-5')).toBeNull()
    expect(parseRub('abc')).toBeNull()
    expect(parseRub('100000000')).toBeNull()
  })
  it('accepts up to 99 999 999 ₽', () => {
    expect(parseRub('99 999 999')).toBe(MAX_KOPECKS)
  })
})

describe('evalExpression', () => {
  it('evaluates plain numbers', () => {
    expect(evalExpression('120')).toBe(12000)
    expect(evalExpression('35,5')).toBe(3550)
    expect(evalExpression('0.1')).toBe(10)
  })
  it('respects precedence', () => {
    expect(evalExpression('120+35,5×2')).toBe(19100)
    expect(evalExpression('100−20÷4')).toBe(9500)
    expect(evalExpression('10*3-5/2')).toBe(2750)
  })
  it('avoids float drift', () => {
    expect(evalExpression('0,1+0,2')).toBe(30)
    expect(evalExpression('19,99×3')).toBe(5997)
  })
  it('ignores a trailing operator', () => {
    expect(evalExpression('120+')).toBe(12000)
  })
  it('rejects invalid input', () => {
    expect(evalExpression('')).toBeNull()
    expect(evalExpression('+5')).toBeNull()
    expect(evalExpression('5++5')).toBeNull()
    expect(evalExpression('5÷0')).toBeNull()
    expect(evalExpression('5a')).toBeNull()
  })
})
