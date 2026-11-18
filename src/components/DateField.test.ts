import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CalendarMonth } from '../components/DateField'

describe('CalendarMonth', () => {
  it('prints weekday headers from Monday and puts a Sunday in the last column', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarMonth, {
        cursor: '2026-11-18',
        value: '2026-11-18',
        max: '2026-11-18',
        onPick() {},
        onMove() {},
      }),
    )
    const headers = html.slice(html.indexOf('cal-week'), html.indexOf('cal-grid'))
    expect([...headers.matchAll(/>([^<]+)</g)].map((m) => m[1])).toEqual(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'])
    // 1 Nov 2026 is a Sunday, so the seventh day cell is that date, not the first.
    const days = [...html.matchAll(/data-iso="([^"]+)"/g)].map((m) => m[1])
    expect(days[0]).toBe('2026-10-26')
    expect(days[6]).toBe('2026-11-01')
  })
})
