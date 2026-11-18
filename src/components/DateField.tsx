import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { MONTHS, WEEKDAYS, formatDateRu, formatDateShort, isoDate, monthGrid, parseISODate, shiftDays } from '../lib/calendar'
import { todayISO } from '../lib/totals'

interface MonthProps {
  cursor: string
  value: string
  max: string
  onPick(iso: string): void
  onMove(iso: string): void
}

const STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

/** Month grid. Weeks always start on Monday — the native date input follows the browser locale and often opens on Sunday. */
export function CalendarMonth({ cursor, value, max, onPick, onMove }: MonthProps) {
  const today = todayISO()
  const { y: year, m: month } = parseISODate(cursor)!
  const activeDay = useRef<HTMLButtonElement>(null)
  const focusDay = useRef(true)
  const monthStart = (delta: number) => {
    const date = new Date(year, month - 1 + delta, 1)
    return isoDate(date.getFullYear(), date.getMonth() + 1, 1)
  }
  const nextDisabled = monthStart(1) > max

  useEffect(() => {
    if (focusDay.current) activeDay.current?.focus()
    focusDay.current = false
  }, [cursor])

  const onKey = (e: ReactKeyboardEvent<HTMLButtonElement>, day: string) => {
    const step = STEP[e.key]
    if (!step) return
    e.preventDefault()
    e.stopPropagation()
    const iso = shiftDays(day, step)
    if (iso > max) return
    if (iso === cursor) activeDay.current?.focus()
    else {
      focusDay.current = true
      onMove(iso)
    }
  }

  return (
    <div className="cal" role="group" aria-label="Выбор даты">
      <div className="cal-head">
        <button type="button" className="cal-nav" aria-label="Предыдущий месяц" onClick={() => onMove(monthStart(-1))}>
          <ChevronLeft size={20} />
        </button>
        <strong aria-live="polite">
          {MONTHS[month - 1]} {year}
        </strong>
        <button type="button" className="cal-nav" aria-label="Следующий месяц" disabled={nextDisabled} onClick={() => onMove(monthStart(1))}>
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="cal-week" aria-hidden="true">
        {WEEKDAYS.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      <div className="cal-grid">
        {monthGrid(year, month).map((cell) => (
          <button
            key={cell.iso}
            ref={cell.iso === cursor ? activeDay : undefined}
            type="button"
            className={`cal-day${cell.inMonth ? '' : ' out'}${cell.iso === value ? ' on' : ''}${cell.iso === today ? ' today' : ''}`}
            data-iso={cell.iso}
            disabled={cell.iso > max}
            aria-label={formatDateRu(cell.iso)}
            aria-pressed={cell.iso === value}
            onClick={() => onPick(cell.iso)}
            onKeyDown={(e) => onKey(e, cell.iso)}
          >
            {cell.day}
          </button>
        ))}
      </div>
    </div>
  )
}

interface Props {
  value: string
  max: string
  onChange(iso: string): void
  children?: ReactNode
}

export function DateField({ value, max, onChange, children }: Props) {
  const [cursor, setCursor] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const open = cursor !== null

  const closeAndFocus = () => {
    setCursor(null)
    trigger.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setCursor(null)
    }
    // Escape closes the calendar first; stop it here so the sheet underneath does not dismiss.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      closeAndFocus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="date-block" ref={root}>
      <div className="inline">
        <div className="field">
          <span>Дата</span>
          <button
            type="button"
            ref={trigger}
            className={`input date-trigger${open ? ' open' : ''}`}
            aria-label={`Дата, ${formatDateRu(value)}`}
            aria-expanded={open}
            onClick={() => setCursor(open ? null : parseISODate(value) && value <= max ? value : max)}
          >
            <span className="num">{formatDateShort(value)}</span>
            <Calendar size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
      {cursor !== null && (
        <CalendarMonth
          cursor={cursor}
          value={value}
          max={max}
          onPick={(iso) => {
            onChange(iso)
            closeAndFocus()
          }}
          onMove={setCursor}
        />
      )}
    </div>
  )
}
