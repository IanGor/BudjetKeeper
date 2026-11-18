import { describe, expect, it } from 'vitest'
import { WEEKDAYS, monthGrid } from './calendar'

describe('monthGrid', () => {
  it('starts every week on Monday and puts Sunday in the last column', () => {
    expect(WEEKDAYS[0]).toBe('Пн')
    expect(WEEKDAYS[6]).toBe('Вс')

    // 1 Nov 2026 is a Sunday: Monday-first, it is the last cell of the first row.
    const november = monthGrid(2026, 11)
    expect(november[0]).toMatchObject({ iso: '2026-10-26', inMonth: false })
    expect(november[6]).toMatchObject({ iso: '2026-11-01', day: 1, inMonth: true })

    // 1 Oct 2026 is a Thursday: three blanks, then the 1st.
    expect(monthGrid(2026, 10)[3]).toMatchObject({ iso: '2026-10-01', inMonth: true })

    // 1 Jan 2024 is a Monday: the grid opens on that day, not on the previous Sunday.
    expect(monthGrid(2024, 1)[0]).toMatchObject({ iso: '2024-01-01', day: 1, inMonth: true })
  })
})
