import type { ReactNode } from 'react'
import { formatDateRu } from '../lib/calendar'
import { formatRub } from '../lib/money'
import { todayISO } from '../lib/totals'
import { groupTransactionDays } from '../lib/transactionDays'
import type { Transaction } from '../lib/types'

export function TransactionDays({ rows, direction, renderRow }: {
  rows: readonly Transaction[]
  direction(tx: Transaction): number
  renderRow(tx: Transaction): ReactNode
}) {
  const year = todayISO().slice(0, 4)
  return groupTransactionDays(rows, direction).map(({ day, items, total }) => {
    const label = formatDateRu(day)
    return (
      <section key={day} className="transaction-day">
        <div className="transaction-day-head">
          <h3><time dateTime={day}>{day.startsWith(year) ? label.slice(0, -5) : label}</time></h3>
          <span className="transaction-day-total">{formatRub(total, true)}</span>
        </div>
        {items.map(renderRow)}
      </section>
    )
  })
}
