import { useEffect } from 'react'
import { monthStart, msToNextMonth } from '../lib/totals'
import { useBudget } from '../store/budget'

const HOUR = 60 * 60 * 1000

/**
 * A new month starts at 00:00 on the 1st: the sums of income sources and
 * categories start from zero (they count the operations of the current month),
 * account balances carry on, plans stay as they are. An app left open over
 * midnight switches by itself; one coming back from the background reloads anyway.
 * The wait is capped at an hour: timers drift while a phone sleeps, and
 * setTimeout cannot wait a whole month.
 */
export function useMonthRollover() {
  useEffect(() => {
    let timer = 0
    const tick = () => {
      if (monthStart() !== useBudget.getState().month) void useBudget.getState().refreshTotals()
      timer = window.setTimeout(tick, Math.min(msToNextMonth() + 50, HOUR))
    }
    tick()
    return () => window.clearTimeout(timer)
  }, [])
}
