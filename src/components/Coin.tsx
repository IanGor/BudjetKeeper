import { Plus } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useArrange } from '../hooks/useArrange'
import { useDrag, useCoinDrag, useDropRole } from '../hooks/useCoinDrag'
import { iconFor } from '../lib/icons'
import { formatRubWhole } from '../lib/money'
import { canDragFrom, planFill } from '../lib/rules'
import type { Entity } from '../lib/types'

interface OrbProps {
  entity: Entity
  /** spending against the plan 0..1: a neutral disc fills up with the category color */
  fill?: number
}

/**
 * Income sources and accounts are flat discs of their color; categories are a light tint with a colored glyph.
 * With `fill` a category is a neutral disc that fills from the bottom like a glass: the filled part is
 * a solid disc of its color with a white glyph, clipped to the level.
 */
export function Orb({ entity, fill }: OrbProps) {
  const Icon = iconFor(entity.icon)
  const kind = fill !== undefined ? 'gauge' : entity.kind === 'expense' ? 'tinted' : 'solid'
  return (
    <span className={`orb ${kind}`} style={{ '--c': entity.color, '--fill': fill } as CSSProperties}>
      <Icon strokeWidth={2} />
      {fill !== undefined && (
        <span className="orb-fill" aria-hidden="true">
          <Icon strokeWidth={2} />
        </span>
      )}
    </span>
  )
}

interface CoinProps {
  entity: Entity
  total: number
  entities: Record<string, Entity>
  onTap(entity: Entity): void
  onDrop(from: Entity, to: Entity): void
}

export function Coin({ entity, total, entities, onTap, onDrop }: CoinProps) {
  const ref = useCoinDrag({ entity, entities, onTap, onDrop })
  const role = useDropRole(entity)
  const plan = entity.plan_kopecks
  const hasPlan = plan != null && plan > 0
  const gauge = entity.kind === 'expense' ? planFill(total, plan) : undefined

  return (
    <button
      ref={ref}
      type="button"
      data-entity-id={entity.id}
      className={`coin-cell${canDragFrom(entity.kind) ? ' draggable' : ''}${role ? ` role-${role}` : ''}`}
      // pointer taps are handled by the drag hook; this keeps keyboard access
      onClick={(e) => e.detail === 0 && !useArrange.getState().editing && onTap(entity)}
    >
      <Orb entity={entity} fill={gauge?.fill} />
      <CoinName>{entity.name}</CoinName>
      <Fit
        className={`coin-amount${total < 0 ? ' neg' : ''}${gauge?.over ? ' over' : ''}${entity.in_balance === false ? ' aside' : ''}`}
        text={formatRubWhole(total)}
      />
      {/* the plan line is kept even when empty, so all categories line up */}
      {entity.kind === 'expense' && <Fit className="coin-plan" text={hasPlan ? `из ${formatRubWhole(plan)}` : ''} />}
    </button>
  )
}

/**
 * A one-line caption that shrinks to the width of its coin when it is long
 * ("−99 999 999"): its width in em is estimated generously (bold digits of the
 * widest fallback fonts), and CSS takes min(its size, coin width / that).
 */
function Fit({ className, text }: { className: string; text: string }) {
  const ems = [...text].reduce((w, ch) => w + (/\d/.test(ch) ? 0.7 : ch === '−' ? 0.84 : ch === '\u202f' ? 0.33 : 0.62), 0)
  return (
    <span className={className} style={{ '--ems': Math.max(ems, 1) } as CSSProperties}>
      {text}
    </span>
  )
}

/** A fixed two-line slot: short and long names alike leave the amount below at the same height. */
function CoinName({ children }: { children: string }) {
  return (
    <span className="coin-name">
      <span>{children}</span>
    </span>
  )
}

export function AddTile({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button type="button" className="coin-cell add-tile" onClick={onClick} aria-label={label}>
      <span className="orb add">
        <Plus strokeWidth={2} />
      </span>
      <CoinName>{label}</CoinName>
    </button>
  )
}

export function DragGhost() {
  const { source, x, y, returning } = useDrag()
  if (!source) return null
  // lifted above the finger while dragging so the coin stays visible; centered when landing back.
  // Percentages are of the ghost itself, i.e. of the orb, whose size follows the column width.
  const dy = returning ? -50 : -90
  return (
    <div
      className={`ghost${returning ? ' returning' : ''}`}
      style={{ transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, ${dy}%)` }}
    >
      <Orb entity={source} />
    </div>
  )
}
