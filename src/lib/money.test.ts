import { describe, expect, it } from 'vitest'
import { evalExpression, formatRub, formatRubShort, parseRub } from './money'

const n = (s: string) => s.replace(/ /g, ' ')

describe('formatRub', () => {
  it('groups thousands and hides zero kopecks', () => {
    expect(n(formatRub(123456700))).toBe('1 234 567 ₽')
    expect(n(formatRub(0))).toBe('0 ₽')
  })
  it('shows kopecks when present', () => {
    expect(n(formatRub(1234550))).toBe('12 345,50 ₽')
    expect(n(formatRub(5))).toBe('0,05 ₽')
  })
  it('prints sign', () => {
    expect(n(formatRub(-15000))).toBe('−150 ₽')
    expect(n(formatRub(15000, true))).toBe('+150 ₽')
  })
})

describe('formatRubShort', () => {
  it('compacts large values', () => {
    expect(n(formatRubShort(9_999_900))).toBe('99 999')
    expect(n(formatRubShort(12_345_600))).toBe('123,5 тыс')
    expect(n(formatRubShort(250_000_000))).toBe('2,5 млн')
    expect(n(formatRubShort(-50_000))).toBe('−500')
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
