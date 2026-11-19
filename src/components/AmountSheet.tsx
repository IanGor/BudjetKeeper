import { ArrowLeftRight, Delete } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useOnline } from '../hooks/useOnline'
import { hasOperator, kopecksToInput, pressKey, type Key } from '../lib/keypad'
import { evalExpression, formatRub, MAX_KOPECKS } from '../lib/money'
import { celebrateDrop } from '../lib/celebrate'
import { canFlow, flowLabel, roundupApplies, roundUpExtra } from '../lib/rules'
import { adjustmentFor, todayISO } from '../lib/totals'
import type { Entity, Transaction } from '../lib/types'
import { useBudget } from '../store/budget'
import { Orb } from './Coin'
import { DateField } from './DateField'
import { Sheet } from './Sheet'

interface Props {
  /** null on one side = balance adjustment */
  from: Entity | null
  to: Entity | null
  /** existing transaction when editing */
  tx?: Transaction
  /** "set balance" mode: the entered value is the account's new balance */
  balance?: { account: Entity; current: number }
  onClose(): void
}

const KEYS: Key[] = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '.', '0', 'back', '+']
const KEYBOARD: Record<string, Key> = { '.': '.', ',': '.', '+': '+', '-': '−', '*': '×', '/': '÷', Backspace: 'back' }
const ADJUSTMENT = 'Корректировка'
const ROUNDUP = 'Округление'

function SidePicker({ label, value, options, onChange }: { label: string; value: string; options: Entity[]; onChange(id: string): void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="input" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export function AmountSheet({ from: fromProp, to: toProp, tx, balance, onClose }: Props) {
  const [expr, setExpr] = useState(tx ? kopecksToInput(tx.amount_kopecks) : '')
  const [date, setDate] = useState(tx?.occurred_at ?? todayISO())
  const [comment, setComment] = useState(tx?.comment ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Keep the selected endpoints in the draft, alongside the amount, date and comment.
  const [fromId, setFromId] = useState(fromProp?.id ?? null)
  const [toId, setToId] = useState(toProp?.id ?? null)
  const entities = useBudget((s) => s.entities)
  const from = (fromId && entities[fromId]) || null
  const to = (toId && entities[toId]) || null
  // rounding up is on whenever the round-up account allows it; this switches it off once
  const [noRoundup, setNoRoundup] = useState(false)
  const online = useOnline()
  const addTransaction = useBudget((s) => s.addTransaction)
  const addTransactions = useBudget((s) => s.addTransactions)
  const household = useBudget((s) => s.household)
  const roundupAccount = useBudget((s) => (s.household?.roundup_account_id ? s.entities[s.household.roundup_account_id] : undefined))
  const updateTransaction = useBudget((s) => s.updateTransaction)
  const deleteTransaction = useBudget((s) => s.deleteTransaction)

  const amount = evalExpression(expr)
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const delta = balance && amount !== null ? amount - balance.current : 0
  const moved = fromId !== (fromProp?.id ?? null) || toId !== (toProp?.id ?? null)
  const isTransfer = from?.kind === 'account' && to?.kind === 'account'
  const validSides = from && to
    ? from.id !== to.id && from.kind === fromProp?.kind && to.kind === toProp?.kind && canFlow(from.kind, to.kind)
    : Boolean(tx && (from ?? to)?.kind === 'account' && (!fromId || !toId))
  const valid =
    dateOk && amount !== null && amount <= MAX_KOPECKS && (balance ? delta !== 0 : amount > 0 && validSides)

  // a new spending or transfer from an account is rounded up to the step of the
  // settings: the target gets the real sum, the difference goes to the round-up account
  const roundup =
    !tx && !balance && household && from && to && roundupAccount && !roundupAccount.archived && roundupApplies(household, from, to)
      ? roundupAccount
      : null
  const roundable = roundup && amount !== null ? roundUpExtra(amount, household!.roundup_step) : 0
  const extra = noRoundup ? 0 : roundable

  const isAdjustment = !balance && (from === null || to === null)
  const account = balance?.account ?? (isAdjustment ? (from ?? to) : null)
  const title = balance ? 'Баланс счёта' : isAdjustment ? ADJUSTMENT : flowLabel(from!.kind, to!.kind)

  // Keep each picker in its original section, even when editing a saved operation.
  const pick = (side: 'from' | 'to') => {
    const current = side === 'from' ? fromId : toId
    const opposite = side === 'from' ? toId : fromId
    const kind = (side === 'from' ? fromProp : toProp)?.kind ?? 'account'
    return Object.values(entities).filter(
      (e) => e.id === current || (!e.archived && e.id !== opposite && e.kind === kind),
    )
  }

  // Totals are updated optimistically by the store, so the sheet closes at once;
  // a failed write is rolled back there and reported with a toast.
  const submit = () => {
    if (!valid || !online || amount === null) return
    const note = comment.trim() || null
    if (balance) {
      const adj = adjustmentFor(balance.account.id, balance.current, amount)
      if (adj) void addTransaction({ ...adj, occurred_at: date, comment: note ?? ADJUSTMENT })
    } else if (tx) {
      void updateTransaction(tx, { amount_kopecks: amount, occurred_at: date, comment: note, ...(moved && { from_id: fromId, to_id: toId }) })
    } else {
      const id = crypto.randomUUID()
      const spending = { id, from_id: from!.id, to_id: to!.id, amount_kopecks: amount, occurred_at: date, comment: note }
      if (to!.kind === 'expense') celebrateDrop(to!.id)
      void addTransactions(
        roundup && extra > 0
          ? [spending, { from_id: from!.id, to_id: roundup.id, amount_kopecks: extra, occurred_at: date, comment: ROUNDUP, roundup_of: id }]
          : [spending],
      )
    }
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.closest('.date-block, .flow-swap'))) return
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
    <Sheet title={title} subtitle={tx ? 'Изменение операции' : undefined} onClose={onClose}>
      {tx && isAdjustment ? (
        <SidePicker label="Счёт" value={(fromId ?? toId)!} options={pick(fromId ? 'from' : 'to')} onChange={fromId ? setFromId : setToId} />
      ) : !balance && from && to ? (
        <div className="inline">
          <SidePicker label="Откуда" value={from.id} options={pick('from')} onChange={setFromId} />
          {isTransfer && !from.archived && !to.archived && (
            <button
              type="button"
              className="input flow-swap"
              aria-label="Поменять местами"
              onClick={() => { setFromId(to.id); setToId(from.id) }}
            >
              <ArrowLeftRight size={18} aria-hidden="true" />
            </button>
          )}
          <SidePicker label="Куда" value={to.id} options={pick('to')} onChange={setToId} />
        </div>
      ) : account ? (
        <div className="flow">
          <div className="side">
            <Orb entity={account} />
            <span>{account.name}</span>
          </div>
          <div className="flow-note">
            {balance ? (
              <>
                <span>Сейчас</span>
                <strong className="num">{formatRub(balance.current)}</strong>
              </>
            ) : (
              <>
                <span>Корректировка</span>
                <strong>{to ? 'увеличение' : 'уменьшение'}</strong>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="display num" aria-live="polite">
        <span className="expr">{hasOperator(expr) ? expr : balance ? 'Новый баланс' : ''}</span>
        {amount !== null ? (
          <span className="value">{formatRub(amount)}</span>
        ) : (
          <span className="placeholder">{formatRub(balance ? balance.current : 0)}</span>
        )}
        {roundup && roundable > 0 && amount !== null && (
          <span className="delta roundup">
            <span>
              {noRoundup
                ? 'Без округления'
                : `С «${from!.name}» спишется ${formatRub(amount + extra)} · ${formatRub(extra)} → «${roundup.name}»`}
            </span>
            <button type="button" className="roundup-toggle" aria-pressed={noRoundup} onClick={() => setNoRoundup((t) => !t)}>
              Не округлять
            </button>
          </span>
        )}
        {balance && amount !== null && (
          <span className={`delta${delta < 0 ? ' neg' : ''}`}>
            {delta === 0 ? 'Без изменений' : `${formatRub(delta, true)} будет записано как корректировка`}
          </span>
        )}
      </div>

      <DateField value={date} max={todayISO()} onChange={setDate}>
        <label className="field">
          <span>Комментарий</span>
          <input
            className="input"
            value={comment}
            maxLength={200}
            placeholder={balance || isAdjustment ? ADJUSTMENT : 'необязательно'}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>
      </DateField>

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
        <button type="button" className="key done" disabled={!valid || !online} onClick={submit}>
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
