import { describe, expect, it } from 'vitest'
import { hasOperator, kopecksToInput, pressKey, type Key } from './keypad'

const type = (keys: Key[], start = '') => keys.reduce(pressKey, start)

describe('pressKey', () => {
  it('builds numbers', () => {
    expect(type(['1', '2', '0'])).toBe('120')
  })
  it('replaces a leading zero', () => {
    expect(type(['0', '5'])).toBe('5')
    expect(type(['1', '+', '0', '7'])).toBe('1+7')
  })
  it('adds a zero before a leading comma and allows one comma per number', () => {
    expect(type([',', '5'])).toBe('0,5')
    expect(type(['1', ',', ',', '2'])).toBe('1,2')
    expect(type(['1', ',', '2', '+', ',', '3'])).toBe('1,2+0,3')
  })
  it('takes at most 8 digits of rubles per number: 99 999 999 ₽', () => {
    const nines = Array<Key>(9).fill('9')
    expect(type(nines)).toBe('99999999')
    expect(type([...nines, ',', '5'])).toBe('99999999,5')
    expect(type(['1', '+', ...nines])).toBe('1+99999999')
  })
  it('limits kopecks to two digits', () => {
    expect(type(['1', ',', '2', '3', '4'])).toBe('1,23')
  })
  it('handles operators', () => {
    expect(type(['+'])).toBe('')
    expect(type(['5', '+', '×'])).toBe('5×')
    expect(type(['5', ',', '−'])).toBe('5−')
  })
  it('backspace removes the last char', () => {
    expect(type(['1', '2', 'back'])).toBe('1')
    expect(type(['back'])).toBe('')
  })
})

describe('kopecksToInput', () => {
  it('formats for editing', () => {
    expect(kopecksToInput(12000)).toBe('120')
    expect(kopecksToInput(123450)).toBe('1234,5')
    expect(kopecksToInput(1205)).toBe('12,05')
  })
})

describe('hasOperator', () => {
  it('detects operators', () => {
    expect(hasOperator('12')).toBe(false)
    expect(hasOperator('12÷3')).toBe(true)
  })
})
