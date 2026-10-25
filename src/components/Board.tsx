import { ChevronDown, Settings2, Star, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { orderedKind, stopEditing, useArrange } from '../hooks/useArrange'
import { useDrag } from '../hooks/useCoinDrag'
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
const PHI = 1.618 // --phi in styles.css

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
  const dragging = useDrag((s) => s.source !== null)
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
      className={`board${editing ? ' editing' : ''}${dragging ? ' dragging' : ''}`}
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

      <PagedSection
        title="Доходы"
        meta={formatRub(incomeSum)}
        open={incomeOpen}
        onToggle={toggleIncome}
        dragKey="income"
        rows={1}
        items={[...incomes.map(coin), add('income', 'Источник')]}
      />
      <PagedSection
        title="Счета"
        meta={formatRub(balance)}
        neg={balance < 0}
        dragKey="accounts"
        rows={1}
        items={[...accounts.map(coin), add('account', 'Счёт')]}
      />
      <PagedSection
        className="expenses"
        title="Расходы"
        meta={formatRub(expenseSum)}
        dragKey="expenses"
        rows="fit"
        items={[...expenses.map(coin), add('expense', 'Категория')]}
      />

      <DragGhost />
      {flow && <AmountSheet from={flow.from} to={flow.to} onClose={() => setFlow(null)} />}
      {opened && <EntitySheet entity={opened} onClose={() => setOpenedId(null)} />}
      {creating && <EntityEditor kind={creating} onClose={() => setCreating(null)} />}
      {settings && <Settings onClose={() => setSettings(false)} />}
    </div>
  )
}

interface PagedSectionProps {
  title: string
  meta: string
  neg?: boolean
  className?: string
  /** collapsible section: the head toggles it */
  open?: boolean
  onToggle?(): void
  dragKey: string
  rows: number | 'fit'
  items: ReactNode[]
}

/**
 * A section of coins on one grid: `--cols` equal columns across the content
 * width, the same in every section, paged sideways. Page dots sit in the head.
 */
function PagedSection({ title, meta, neg, className, open, onToggle, dragKey, rows, items }: PagedSectionProps) {
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(1)
  const collapsible = onToggle !== undefined
  const shown = items.filter(Boolean)

  const head = (
    <>
      <span className="section-title">{title}</span>
      {pages > 1 && (
        <span className="dots" aria-hidden="true">
          {Array.from({ length: pages }, (_, i) => (
            <span key={i} className={`dot${i === page ? ' on' : ''}`} />
          ))}
        </span>
      )}
      <span className={`section-meta${neg ? ' neg' : ''}`}>{meta}</span>
      {collapsible && <ChevronDown size={18} className={`chevron${open ? ' open' : ''}`} />}
    </>
  )
  const pager = <Pager items={shown} rows={rows} dragKey={dragKey} onPage={setPage} onPages={setPages} />

  return (
    <section className={`section${className ? ` ${className}` : ''}`}>
      {collapsible ? (
        <button type="button" className="section-head" onClick={onToggle} aria-expanded={open}>
          {head}
        </button>
      ) : (
        <div className="section-head">{head}</div>
      )}
      {collapsible ? (
        <div className={`collapse${open ? ' open' : ''}`}>
          <div>{pager}</div>
        </div>
      ) : (
        pager
      )}
    </section>
  )
}

interface PagerProps {
  items: ReactNode[]
  rows: number | 'fit'
  dragKey: string
  onPage(page: number): void
  onPages(pages: number): void
}

/**
 * Coins in pages of cols×rows. All cells share one grid parent and are placed
 * page by page, so a coin dragged to another page keeps its element (no remount
 * mid-gesture) and glides there.
 *
 * The pager is full-bleed: each page is gutter + cols columns + gutter, so a
 * swipe moves the coins to the screen edge. With rows="fit" as many rows as fit
 * the height left are used (the coin height is measured, not assumed).
 */
function Pager({ items, rows: rowsProp, dragKey, onPage, onPages }: PagerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState({ cols: 4, rows: rowsProp === 'fit' ? 3 : rowsProp, rowHeight: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const cols = Number(getComputedStyle(el).getPropertyValue('--cols')) || 4
      let rows = typeof rowsProp === 'number' ? rowsProp : 1
      let rowHeight = 0
      if (rowsProp === 'fit') {
        let cell = 0
        el.querySelectorAll<HTMLElement>('.coin-cell').forEach((c) => (cell = Math.max(cell, c.offsetHeight)))
        if (!cell || !el.clientHeight) return
        // as many rows as fit, but no empty ones when everything is on one page
        rows = Math.max(1, Math.min(Math.floor(el.clientHeight / cell), Math.ceil(items.length / cols)))
        // spare height is spread between the rows, up to a golden rectangle per cell
        const golden = Math.floor((el.querySelector<HTMLElement>('.pager-cell')?.offsetWidth ?? 0) * PHI)
        rowHeight = Math.max(cell, Math.min(Math.floor(el.clientHeight / rows), golden))
      }
      setLayout((prev) =>
        prev.cols === cols && prev.rows === rows && prev.rowHeight === rowHeight ? prev : { cols, rows, rowHeight },
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [items.length, rowsProp])

  const { cols, rows } = layout
  const perPage = cols * rows
  const pages = Math.max(1, Math.ceil(items.length / perPage))
  useEffect(() => onPages(pages), [pages, onPages])

  const page = `var(--gutter) repeat(${cols}, calc((100% - 2 * var(--gutter)) / ${cols})) var(--gutter)`

  return (
    <div
      ref={ref}
      className={`pager${rowsProp === 'fit' ? ' fit' : ''}`}
      data-drag-scroll={dragKey}
      style={{
        gridTemplateColumns: Array(pages).fill(page).join(' '),
        // pages share row tracks; fixed rows keep a tall cell on one page from stretching the others
        gridAutoRows: layout.rowHeight ? `${layout.rowHeight}px` : 'min-content',
      }}
      onScroll={(e) => onPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
    >
      {items.map((item, i) => {
        const p = Math.floor(i / perPage)
        const r = Math.floor((i % perPage) / cols)
        const c = i % cols
        return (
          <div
            key={(item as { key?: string }).key ?? i}
            className="pager-cell"
            style={{ gridColumn: p * (cols + 2) + c + 2, gridRow: r + 1, scrollSnapAlign: i % perPage === 0 ? 'start' : undefined }}
          >
            {item}
          </div>
        )
      })}
    </div>
  )
}
