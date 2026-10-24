import { useEffect, useState } from 'react'
import { useOnline } from '../hooks/useOnline'
import { COLORS, DEFAULT_COLOR, ICON_CHOICES, iconFor } from '../lib/icons'
import { formatRub, parseRub } from '../lib/money'
import type { Entity, EntityKind, Transaction } from '../lib/types'
import { useBudget } from '../store/budget'
import { AmountSheet } from './AmountSheet'
import { Sheet } from './Sheet'

const KIND_LABEL: Record<EntityKind, string> = { income: 'Источник дохода', account: 'Счёт', expense: 'Категория' }

export function EntitySheet({ entity, onClose }: { entity: Entity; onClose(): void }) {
  const [tab, setTab] = useState<'ops' | 'edit'>('ops')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [list, setList] = useState<Transaction[] | null>(null)
  const entities = useBudget((s) => s.entities)
  const members = useBudget((s) => s.members)
  const total = useBudget((s) => s.totals[entity.id] ?? 0)
  const txVersion = useBudget((s) => s.txVersion)
  const fetchTransactions = useBudget((s) => s.fetchTransactions)

  useEffect(() => {
    let alive = true
    void fetchTransactions(entity.id).then((l) => alive && setList(l))
    return () => {
      alive = false
    }
  }, [entity.id, txVersion, fetchTransactions])

  const author = (id: string | null) => members.find((m) => m.user_id === id)?.display_name

  if (editing) {
    const from = entities[editing.from_id]
    const to = entities[editing.to_id]
    if (from && to) return <AmountSheet from={from} to={to} tx={editing} onClose={() => setEditing(null)} />
  }

  return (
    <Sheet title={`${entity.name} · ${formatRub(total)}`} onClose={onClose}>
      <div className="tabs">
        <button type="button" className={tab === 'ops' ? 'on' : ''} onClick={() => setTab('ops')}>
          Операции
        </button>
        <button type="button" className={tab === 'edit' ? 'on' : ''} onClick={() => setTab('edit')}>
          Настройки
        </button>
      </div>

      {tab === 'edit' ? (
        <EntityForm kind={entity.kind} entity={entity} onDone={onClose} />
      ) : list === null ? (
        <div className="empty">Загрузка…</div>
      ) : list.length === 0 ? (
        <div className="empty">Операций пока нет</div>
      ) : (
        <ul className="tx-list">
          {list.map((tx) => {
            const incoming = tx.to_id === entity.id
            const other = entities[incoming ? tx.from_id : tx.to_id]
            // money arriving to an account, or income received from a source, is shown as "+"
            const plus = (incoming && entity.kind === 'account') || entity.kind === 'income'
            const sub = [formatDate(tx.occurred_at), author(tx.created_by), tx.comment].filter(Boolean).join(' · ')
            return (
              <li key={tx.id}>
                <button type="button" className="tx" onClick={() => setEditing(tx)}>
                  <div className="main">
                    <div>
                      {incoming ? '← ' : '→ '}
                      {other?.name ?? '—'}
                    </div>
                    <div className="sub">{sub}</div>
                  </div>
                  <span className={`amt${plus ? ' in' : ''}`}>
                    {plus ? '+' : '−'}
                    {formatRub(tx.amount_kopecks)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}

export function EntityEditor({ kind, onClose }: { kind: EntityKind; onClose(): void }) {
  return (
    <Sheet title={`Новый: ${KIND_LABEL[kind].toLowerCase()}`} onClose={onClose}>
      <EntityForm kind={kind} onDone={onClose} />
    </Sheet>
  )
}

function EntityForm({ kind, entity, onDone }: { kind: EntityKind; entity?: Entity; onDone(): void }) {
  const createEntity = useBudget((s) => s.createEntity)
  const updateEntity = useBudget((s) => s.updateEntity)
  const online = useOnline()
  const [name, setName] = useState(entity?.name ?? '')
  const [icon, setIcon] = useState(entity?.icon ?? ICON_CHOICES[kind][0])
  const [color, setColor] = useState(entity?.color ?? DEFAULT_COLOR[kind])
  const [plan, setPlan] = useState(entity?.plan_kopecks != null ? String(entity.plan_kopecks / 100).replace('.', ',') : '')
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [busy, setBusy] = useState(false)

  const hasPlan = kind !== 'account'
  const planKopecks = plan.trim() === '' ? null : parseRub(plan)
  const planInvalid = plan.trim() !== '' && planKopecks === null
  const valid = name.trim().length > 0 && !planInvalid
  const icons = ICON_CHOICES[kind].includes(icon) ? ICON_CHOICES[kind] : [icon, ...ICON_CHOICES[kind]]

  const save = async () => {
    if (!valid || busy) return
    setBusy(true)
    const fields = { name: name.trim(), icon, color, plan_kopecks: hasPlan ? planKopecks : null }
    const ok = entity ? await updateEntity(entity.id, fields) : (await createEntity({ kind, ...fields })) !== null
    setBusy(false)
    if (ok) onDone()
  }

  const archive = async () => {
    if (!entity) return
    if (!confirmArchive) {
      setConfirmArchive(true)
      return
    }
    if (await updateEntity(entity.id, { archived: true })) onDone()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <label className="field">
        <span>Название</span>
        <input className="input" value={name} maxLength={40} autoFocus={!entity} onChange={(e) => setName(e.target.value)} />
      </label>

      {hasPlan && (
        <label className="field">
          <span>{kind === 'income' ? 'План дохода в месяц, ₽' : 'Бюджет на месяц, ₽'}</span>
          <input
            className="input"
            inputMode="decimal"
            value={plan}
            placeholder="без плана"
            onChange={(e) => setPlan(e.target.value)}
          />
          {planInvalid && <span className="error">Введите сумму, например 15000 или 999,90</span>}
        </label>
      )}

      <div className="field">
        <span>Иконка</span>
        <div className="icon-grid">
          {icons.map((name) => {
            const Icon = iconFor(name)
            return (
              <button key={name} type="button" className={name === icon ? 'on' : ''} onClick={() => setIcon(name)} aria-label={name}>
                <Icon size={22} />
              </button>
            )
          })}
        </div>
      </div>

      <div className="field">
        <span>Цвет</span>
        <div className="color-row">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={c === color ? 'on' : ''}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      <div className="btn-row">
        <button type="submit" className="btn" disabled={!valid || busy || !online}>
          {entity ? 'Сохранить' : 'Добавить'}
        </button>
      </div>
      {entity && (
        <div className="btn-row">
          <button type="button" className="btn danger" onClick={archive} disabled={!online}>
            {confirmArchive ? 'Точно скрыть? Операции сохранятся' : 'Скрыть'}
          </button>
        </div>
      )}
    </form>
  )
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y === String(new Date().getFullYear()) ? `${d}.${m}` : `${d}.${m}.${y}`
}
