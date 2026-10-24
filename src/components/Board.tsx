import { ChevronDown, ChevronUp, Settings as SettingsIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRealtime } from '../hooks/useRealtime'
import { formatRub, formatRubShort } from '../lib/money'
import type { Entity, EntityKind } from '../lib/types'
import { selectKind, useBudget } from '../store/budget'
import { AmountSheet } from './AmountSheet'
import { AddTile, Coin, DragGhost } from './Coin'
import { EntityEditor, EntitySheet } from './EntitySheet'
import { Settings } from './Settings'

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const INCOME_OPEN_KEY = 'bk.incomeOpen'

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // storage unavailable (private mode) — the drawer just won't remember its state
  }
}

export function Board() {
  useRealtime()
  const entities = useBudget((s) => s.entities)
  const totals = useBudget((s) => s.totals)
  const month = useBudget((s) => s.month)

  const [flow, setFlow] = useState<{ from: Entity; to: Entity } | null>(null)
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [creating, setCreating] = useState<EntityKind | null>(null)
  const [settings, setSettings] = useState(false)
  const [incomeOpen, setIncomeOpen] = useState(() => readFlag(INCOME_OPEN_KEY))

  const incomes = useMemo(() => selectKind(entities, 'income'), [entities])
  const accounts = useMemo(() => selectKind(entities, 'account'), [entities])
  const expenses = useMemo(() => selectKind(entities, 'expense'), [entities])

  const onDrop = useCallback((from: Entity, to: Entity) => setFlow({ from, to }), [])
  const onTap = useCallback((e: Entity) => setOpenedId(e.id), [])

  const sum = (list: Entity[]) => list.reduce((acc, e) => acc + (totals[e.id] ?? 0), 0)
  const incomeSum = sum(incomes)
  const expenseSum = sum(expenses)
  const balance = sum(accounts)

  const coin = (e: Entity) => (
    <Coin key={e.id} entity={e} total={totals[e.id] ?? 0} entities={entities} onTap={onTap} onDrop={onDrop} />
  )

  const toggleIncome = () => {
    writeFlag(INCOME_OPEN_KEY, !incomeOpen)
    setIncomeOpen(!incomeOpen)
  }

  const opened = openedId ? entities[openedId] : undefined

  return (
    <div className="board">
      <section className="income">
        <div className="income-body" style={{ maxHeight: incomeOpen ? 160 : 0 }}>
          <div className="section-title">Доходы</div>
          <div className="row" data-drag-scroll="income">
            {incomes.map(coin)}
            <AddTile label="Источник" onClick={() => setCreating('income')} />
          </div>
        </div>
        <button type="button" className="income-tab" onClick={toggleIncome}>
          {incomeOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {incomeOpen ? 'Свернуть' : `Доходы · ${formatRubShort(incomeSum)} ₽`}
        </button>
      </section>

      <section className="accounts">
        <div className="section-title">Счета · {formatRub(balance)}</div>
        <div className="row" data-drag-scroll="accounts">
          {accounts.map(coin)}
          <AddTile label="Счёт" onClick={() => setCreating('account')} />
        </div>
      </section>

      <section className="expenses">
        <div className="section-title">Расходы</div>
        <CategoryPager
          items={expenses.map(coin)}
          add={<AddTile key="add" label="Категория" onClick={() => setCreating('expense')} />}
        />
      </section>

      <footer className="bottom-bar">
        <button type="button" className="icon-btn" onClick={() => setSettings(true)} aria-label="Настройки">
          <SettingsIcon size={20} />
        </button>
        <div>
          <span className="label">Месяц</span>
          {MONTHS[Number(month.slice(5, 7)) - 1]}
        </div>
        <div className="sum">
          <div>
            <span className="label">Доходы</span>
            {formatRub(incomeSum)}
          </div>
          <div>
            <span className="label">Расходы</span>
            {formatRub(expenseSum)}
          </div>
        </div>
      </footer>

      <DragGhost />
      {flow && <AmountSheet from={flow.from} to={flow.to} onClose={() => setFlow(null)} />}
      {opened && <EntitySheet entity={opened} onClose={() => setOpenedId(null)} />}
      {creating && <EntityEditor kind={creating} onClose={() => setCreating(null)} />}
      {settings && <Settings onClose={() => setSettings(false)} />}
    </div>
  )
}

const CELL_HEIGHT = 118 // name + coin + amount + plan + row gap

function CategoryPager({ items, add }: { items: ReactNode[]; add: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState({ cols: 4, perPage: 16 })
  const [page, setPage] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const cols = el.clientWidth >= 600 ? 6 : 4
      const rows = Math.max(1, Math.floor((el.clientHeight - 10) / CELL_HEIGHT))
      setLayout((prev) => (prev.cols === cols && prev.perPage === cols * rows ? prev : { cols, perPage: cols * rows }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const all = [...items, add]
  const pages: ReactNode[][] = []
  for (let i = 0; i < all.length; i += layout.perPage) pages.push(all.slice(i, i + layout.perPage))

  return (
    <>
      <div
        ref={ref}
        className="pager"
        data-drag-scroll="expenses"
        onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {pages.map((p, i) => (
          <div key={i} className="page" style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)` }}>
            {p}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div className="dots">
          {pages.map((_, i) => (
            <span key={i} className={`dot${i === page ? ' on' : ''}`} />
          ))}
        </div>
      )}
    </>
  )
}
