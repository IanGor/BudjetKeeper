import { ChevronDown, Settings2, Star, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { orderedKind, stopEditing, useArrange } from '../hooks/useArrange'
import { useFlip } from '../hooks/useFlip'
import { useRealtime } from '../hooks/useRealtime'
import { formatRub } from '../lib/money'
import type { Entity, EntityKind } from '../lib/types'
import { useBudget } from '../store/budget'
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
    // storage unavailable (private mode) — the section just won't remember its state
  }
}

export function Board() {
  useRealtime()
  const entities = useBudget((s) => s.entities)
  const totals = useBudget((s) => s.totals)
  const month = useBudget((s) => s.month)
  const householdName = useBudget((s) => s.household?.name)
  const updateEntity = useBudget((s) => s.updateEntity)
  const editing = useArrange((s) => s.editing)
  const draft = useArrange((s) => s.draft)

  const [flow, setFlow] = useState<{ from: Entity; to: Entity } | null>(null)
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [creating, setCreating] = useState<EntityKind | null>(null)
  const [settings, setSettings] = useState(false)
  const [incomeOpen, setIncomeOpen] = useState(() => readFlag(INCOME_OPEN_KEY))

  const incomes = useMemo(() => orderedKind(entities, 'income', draft), [entities, draft])
  const accounts = useMemo(() => orderedKind(entities, 'account', draft), [entities, draft])
  const expenses = useMemo(() => orderedKind(entities, 'expense', draft), [entities, draft])

  const boardRef = useRef<HTMLDivElement>(null)
  useFlip(boardRef, [...incomes, ...accounts, ...expenses].map((e) => e.id).join(','))

  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && stopEditing()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  const onDrop = useCallback((from: Entity, to: Entity) => setFlow({ from, to }), [])
  const onTap = useCallback((e: Entity) => setOpenedId(e.id), [])

  const sum = (list: Entity[]) => list.reduce((acc, e) => acc + (totals[e.id] ?? 0), 0)
  const incomeSum = sum(incomes)
  const expenseSum = sum(expenses)
  const balance = sum(accounts)

  const coin = (e: Entity) => (
    <div key={e.id} className="coin-slot" data-flip-id={e.id}>
      <div className="jiggle">
        <Coin entity={e} total={totals[e.id] ?? 0} entities={entities} onTap={onTap} onDrop={onDrop} />
        {editing && (
          <button
            type="button"
            className="remove-badge"
            aria-label={`Скрыть «${e.name}»`}
            onClick={() => void updateEntity(e.id, { archived: true })}
          >
            <X size={13} strokeWidth={3} />
          </button>
        )}
      </div>
    </div>
  )

  const add = (kind: EntityKind, label: string) =>
    editing ? null : (
      <div key="add" className="coin-slot">
        <AddTile label={label} onClick={() => setCreating(kind)} />
      </div>
    )

  const toggleIncome = () => {
    writeFlag(INCOME_OPEN_KEY, !incomeOpen)
    setIncomeOpen(!incomeOpen)
  }

  const opened = openedId ? entities[openedId] : undefined

  return (
    <div
      ref={boardRef}
      className={`board${editing ? ' editing' : ''}`}
      // tapping empty space leaves edit mode, as on the home screen
      onPointerDown={(e) => editing && !(e.target as Element).closest('.coin-slot, button') && stopEditing()}
    >
      <header className="topbar">
        <div className="titles">
          <div className="eyebrow">{editing ? 'Изменение порядка' : householdName}</div>
          <h1 className="large-title">
            <Star aria-hidden="true" />
            {MONTHS[Number(month.slice(5, 7)) - 1]}
          </h1>
        </div>
        {editing ? (
          <button type="button" className="done-btn" onClick={stopEditing}>
            Готово
          </button>
        ) : (
          <button type="button" className="circle-btn" onClick={() => setSettings(true)} aria-label="Настройки">
            <Settings2 size={18} strokeWidth={2} />
          </button>
        )}
      </header>

      <section className="section">
        <button type="button" className="section-head" onClick={toggleIncome} aria-expanded={incomeOpen}>
          <span className="section-title">Доходы</span>
          <span className="section-meta">{formatRub(incomeSum)}</span>
          <ChevronDown size={18} className={`chevron${incomeOpen ? ' open' : ''}`} />
        </button>
        <div className={`collapse${incomeOpen ? ' open' : ''}`}>
          <div>
            <div className="row" data-drag-scroll="income">
              {incomes.map(coin)}
              {add('income', 'Источник')}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="section-title">Счета</span>
          <span className={`section-meta${balance < 0 ? ' neg' : ''}`}>{formatRub(balance)}</span>
        </div>
        <div className="row" data-drag-scroll="accounts">
          {accounts.map(coin)}
          {add('account', 'Счёт')}
        </div>
      </section>

      <section className="section expenses">
        <div className="section-head">
          <span className="section-title">Расходы</span>
          <span className="section-meta">{formatRub(expenseSum)}</span>
        </div>
        <CategoryPager items={[...expenses.map(coin), add('expense', 'Категория')].filter(Boolean)} />
      </section>

      <DragGhost />
      {flow && <AmountSheet from={flow.from} to={flow.to} onClose={() => setFlow(null)} />}
      {opened && <EntitySheet entity={opened} onClose={() => setOpenedId(null)} />}
      {creating && <EntityEditor kind={creating} onClose={() => setCreating(null)} />}
      {settings && <Settings onClose={() => setSettings(false)} />}
    </div>
  )
}

/**
 * Categories in pages of cols×rows. All cells share one grid parent and are
 * placed page by page, so a coin dragged to another page keeps its element
 * (no remount mid-gesture) and glides there.
 *
 * Rows are fitted to the space that is left: the height of a coin is measured
 * (fonts and line heights differ between iOS and Android), as many rows as fit
 * are used, and the spare height is spread between them.
 */
function CategoryPager({ items }: { items: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState({ cols: 4, rows: 3, rowHeight: 0 })
  const [page, setPage] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      let cell = 0
      el.querySelectorAll<HTMLElement>('.coin-cell').forEach((c) => (cell = Math.max(cell, c.offsetHeight)))
      if (!cell || !el.clientHeight) return
      const cols = el.clientWidth >= 600 ? 6 : 4
      const rows = Math.max(1, Math.floor(el.clientHeight / cell))
      const rowHeight = Math.max(cell, Math.floor(el.clientHeight / rows))
      setLayout((prev) =>
        prev.cols === cols && prev.rows === rows && prev.rowHeight === rowHeight ? prev : { cols, rows, rowHeight },
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [items.length])

  const { cols, rows } = layout
  const perPage = cols * rows
  const pages = Math.max(1, Math.ceil(items.length / perPage))

  return (
    <>
      <div
        ref={ref}
        className="pager"
        data-drag-scroll="expenses"
        style={{
          gridTemplateColumns: `repeat(${pages * cols}, calc(100% / ${cols}))`,
          // pages share row tracks; fixed rows keep a tall cell on one page from stretching the others
          gridAutoRows: layout.rowHeight ? `${layout.rowHeight}px` : 'min-content',
        }}
        onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {items.map((item, i) => {
          const p = Math.floor(i / perPage)
          const r = Math.floor((i % perPage) / cols)
          const c = i % cols
          return (
            <div
              key={(item as { key?: string }).key ?? i}
              className="pager-cell"
              style={{ gridColumn: p * cols + c + 1, gridRow: r + 1, scrollSnapAlign: i % perPage === 0 ? 'start' : undefined }}
            >
              {item}
            </div>
          )
        })}
      </div>
      {pages > 1 && (
        <div className="dots">
          {Array.from({ length: pages }, (_, i) => (
            <span key={i} className={`dot${i === page ? ' on' : ''}`} />
          ))}
        </div>
      )}
    </>
  )
}
