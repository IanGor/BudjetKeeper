import { ArrowRight, Delete } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useOnline } from '../hooks/useOnline'
import { hasOperator, kopecksToInput, pressKey, type Key } from '../lib/keypad'
import { evalExpression, formatRub } from '../lib/money'
import { flowLabel } from '../lib/rules'
import { todayISO } from '../lib/totals'
import type { Entity, Transaction } from '../lib/types'
import { useBudget } from '../store/budget'
import { CoinFace } from './Coin'
import { Sheet } from './Sheet'

interface Props {
  from: Entity
  to: Entity
  /** existing transaction when editing */
  tx?: Transaction
  onClose(): void
}

const KEYS: Key[] = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', ',', '0', 'back', '+']
const KEYBOARD: Record<string, Key> = { '.': ',', ',': ',', '+': '+', '-': '−', '*': '×', '/': '÷', Backspace: 'back' }

export function AmountSheet({ from, to, tx, onClose }: Props) {
  const [expr, setExpr] = useState(tx ? kopecksToInput(tx.amount_kopecks) : '')
  const [date, setDate] = useState(tx?.occurred_at ?? todayISO())
  const [comment, setComment] = useState(tx?.comment ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const online = useOnline()
  const addTransaction = useBudget((s) => s.addTransaction)
  const updateTransaction = useBudget((s) => s.updateTransaction)
  const deleteTransaction = useBudget((s) => s.deleteTransaction)

  const amount = evalExpression(expr)
  const valid = amount !== null && amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date)

  // Totals are updated optimistically by the store, so the sheet closes at once;
  // a failed write is rolled back there and reported with a toast.
  const submit = () => {
    if (!valid || !online) return
    const fields = { amount_kopecks: amount, occurred_at: date, comment: comment.trim() || null }
    if (tx) void updateTransaction(tx, fields)
    else void addTransaction({ from_id: from.id, to_id: to.id, ...fields })
    onClose()
  }

  const remove = () => {
    if (!tx) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    void deleteTransaction(tx)
    onClose()
  }

  // physical keyboard (iPad keyboard, desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'Enter') {
        e.preventDefault()
        submit()
        return
      }
      const key = /^\d$/.test(e.key) ? (e.key as Key) : KEYBOARD[e.key]
      if (key) {
        e.preventDefault()
        setExpr((x) => pressKey(x, key))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <Sheet title={tx ? `${flowLabel(from.kind, to.kind)} · изменить` : flowLabel(from.kind, to.kind)} onClose={onClose}>
      <div className="flow">
        <div className="side">
          <CoinFace entity={from} />
          <span>{from.name}</span>
        </div>
        <ArrowRight size={20} />
        <div className="side">
          <CoinFace entity={to} />
          <span>{to.name}</span>
        </div>
      </div>

      <div className="display" aria-live="polite">
        <span className="expr">{hasOperator(expr) ? expr : ''}</span>
        {amount !== null ? formatRub(amount) : formatRub(0)}
      </div>

      <div className="inline">
        <label className="field">
          <span>Дата</span>
          <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Комментарий</span>
          <input
            className="input"
            value={comment}
            maxLength={200}
            placeholder="необязательно"
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>
      </div>

      <div className="keypad">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={`key${'+−×÷'.includes(k) ? ' op' : ''}`}
            onClick={() => setExpr((x) => pressKey(x, k))}
            aria-label={k === 'back' ? 'Стереть' : k}
          >
            {k === 'back' ? <Delete size={22} /> : k}
          </button>
        ))}
        <button type="button" className="key done" style={{ gridColumn: 'span 4' }} disabled={!valid || !online} onClick={submit}>
          {online ? 'Готово' : 'Нет связи'}
        </button>
      </div>

      {tx && (
        <div className="btn-row">
          <button type="button" className="btn danger" onClick={remove} disabled={!online}>
            {confirmDelete ? 'Точно удалить?' : 'Удалить операцию'}
          </button>
        </div>
      )}
    </Sheet>
  )
}
