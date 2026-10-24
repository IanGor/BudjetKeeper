import { describe, expect, it } from 'vitest'
import { moveId } from './order'

describe('moveId', () => {
  const ids = ['a', 'b', 'c', 'd']
  it('moves forward onto the target slot', () => {
    expect(moveId(ids, 'a', 'c')).toEqual(['b', 'c', 'a', 'd'])
  })
  it('moves backward onto the target slot', () => {
    expect(moveId(ids, 'd', 'b')).toEqual(['a', 'd', 'b', 'c'])
  })
  it('returns the same array when nothing moves', () => {
    expect(moveId(ids, 'b', 'b')).toBe(ids)
    expect(moveId(ids, 'x', 'b')).toBe(ids)
  })
})
