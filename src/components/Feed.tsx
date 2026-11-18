import { ChevronLeft } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { formatRub } from '../lib/money'
import { transactionDirection } from '../lib/transactionDays'
import type { Transaction } from '../lib/types'
import { useBudget } from '../store/budget'
import { AmountSheet } from './AmountSheet'
import { TransactionDays } from './TransactionDays'

const PAGE = 40

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

/** Full-screen feed of all operations: days newest first, inside a day the latest record on top. */
export function Feed({ onClose }: { onClose(): void }) {
  const entities = useBudget((s) => s.entities)
  const members = useBudget((s) => s.members)
  const txVersion = useBudget((s) => s.txVersion)
  const fetchFeed = useBudget((s) => s.fetchFeed)
  const [rows, setRows] = useState<Transaction[] | null>(null)
  const [roundups, setRoundups] = useState<Record<string, Transaction>>({})
  const [more, setMore] = useState(true)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const loading = useRef(false)
  const loaded = useRef(0)
  const sentinel = useRef<HTMLDivElement>(null)

  // `reload` starts over with as many rows as were shown (after an edit or a remote change)
  const load = useCallback(
    async (reload: boolean) => {
      if (loading.current) return
      loading.current = true
      const offset = reload ? 0 : loaded.current
      const limit = reload ? Math.max(loaded.current, PAGE) : PAGE
      const page = await fetchFeed(offset, limit)
      loading.current = false
      if (!page) return
      loaded.current = offset + page.rows.length
      setRows((old) => (reload || !old ? page.rows : [...old, ...page.rows]))
      setRoundups((old) => (reload ? page.roundups : { ...old, ...page.roundups }))
      setMore(page.hasMore)
    },
    [fetchFeed],
  )

  useEffect(() => {
    void load(true)
  }, [txVersion, load])

  useEffect(() => {
    const el = sentinel.current
    if (!el || !more) return
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && void load(false), { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [more, rows, load])

  if (editing) {
    const from = editing.from_id ? entities[editing.from_id] : null
    const to = editing.to_id ? entities[editing.to_id] : null
    if (from !== undefined && to !== undefined && (from || to)) {
      return <AmountSheet from={from} to={to} tx={editing} onClose={() => setEditing(null)} />
    }
  }

  const name = (id: string | null) => (id ? (entities[id]?.name ?? '—') : null)
  const author = (id: string | null) => members.find((m) => m.user_id === id)?.display_name

  const direction = (tx: Transaction) => transactionDirection(tx, entities)

  return (
    <div className="feed" role="dialog" aria-label="Все операции">
      <header className="feed-head">
        <button type="button" className="icon-btn back" aria-label="Закрыть ленту" onClick={onClose}>
          <ChevronLeft size={22} />
        </button>
        <h2>Все операции</h2>
      </header>
      <div className="feed-scroll">
        {rows === null ? (
          <div className="empty">Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className="empty">Операций пока нет</div>
        ) : (
          <TransactionDays
            rows={rows}
            direction={direction}
            renderRow={(tx) => {
              const sign = direction(tx)
              const round = roundups[tx.id]
              const note = [author(tx.created_by), tx.comment].filter(Boolean).join(' · ')
              return (
                <button key={tx.id} type="button" className="feed-row" onClick={() => setEditing(tx)}>
                  <span className="feed-main">
                    <span className="feed-flow">
                      {name(tx.from_id) ?? 'Корректировка'} <span aria-hidden>→</span> {name(tx.to_id) ?? 'Корректировка'}
                    </span>
                    <span className="feed-note">
                      <time dateTime={tx.created_at}>{timeOf(tx.created_at)}</time>{note && ` · ${note}`}
                    </span>
                    {round && (
                      <span className="feed-round">
                        Округление +{formatRub(round.amount_kopecks)} → {name(round.to_id)}
                      </span>
                    )}
                  </span>
                  <span className={`feed-amt${sign > 0 ? ' in' : ''}`}>
                    {formatRub(sign === -1 ? -tx.amount_kopecks : tx.amount_kopecks, sign > 0)}
                  </span>
                </button>
              )
            }}
          />
        )}
        {more && rows !== null && <div ref={sentinel} className="feed-more">Загрузка…</div>}
      </div>
    </div>
  )
}
