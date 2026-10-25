import type { CSSProperties } from 'react'
import { formatInt, formatRubWhole } from '../lib/money'
import { planFill } from '../lib/rules'

interface Props {
  /** spent on all categories this month */
  spent: number
  /** sum of the monthly plans of all categories */
  planned: number
  /** money on the accounts that count in the total balance */
  available: number
  /** how much of the month has passed, 0..1 */
  elapsed: number
}

/**
 * The month at a glance, at the bottom of the board: how much of the planned
 * spending is spent (the bar, red beyond the plan), and how much money there is.
 * The share of the plan is written on the bar. A tick marks today, so spending
 * ahead of the month shows; the money turns red
 * when it does not cover the rest of the plan.
 */
export function PlanBar({ spent, planned, available, elapsed }: Props) {
  const { fill, over } = planFill(spent, planned)
  const short = available < Math.max(planned - spent, 0)
  const percent = planned > 0 ? `${formatInt((Math.max(spent, 0) / planned) * 100)}\u00a0%` : '—'
  return (
    <footer className="plan-bar">
      <div className="plan-bar-text">
        <span className={over ? 'over' : undefined}>
          <strong className="num">{formatRubWhole(spent)}</strong> <span>из</span> <span className="num">{formatRubWhole(planned)}</span>
        </span>
        <span className={short ? 'short' : undefined} title={short ? 'Меньше, чем осталось по плану' : undefined}>
          <strong className="num">{formatRubWhole(available)}</strong> <span>на счетах</span>
        </span>
      </div>
      <div
        className={`plan-bar-track${over ? ' over' : ''}`}
        role="progressbar"
        aria-label="Потрачено из плана на месяц"
        aria-valuemin={0}
        aria-valuemax={planned}
        aria-valuenow={spent}
        style={{ '--fill': fill, '--elapsed': elapsed } as CSSProperties}
      >
        {/* the percentage twice: dark over the track, white over the fill (clipped to it) */}
        <span className="plan-bar-label num">{percent}</span>
        <span className="plan-bar-fill" aria-hidden="true">
          <span className="plan-bar-label num">{percent}</span>
        </span>
        <span className="plan-bar-today" />
      </div>
    </footer>
  )
}
