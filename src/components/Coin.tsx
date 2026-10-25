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
      <span className="coin-name">{entity.name}</span>
      <span className={`coin-amount${total < 0 ? ' neg' : ''}${gauge?.over ? ' over' : ''}`}>{formatRubWhole(total)}</span>
      {hasPlan && <span className="coin-plan">из {formatRubWhole(plan)}</span>}
    </button>
  )
}

export function AddTile({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button type="button" className="coin-cell add-tile" onClick={onClick} aria-label={label}>
      <span className="orb add">
        <Plus strokeWidth={2} />
      </span>
      <span className="coin-name">{label}</span>
    </button>
  )
}

const ORB = 52 // --orb in styles.css

export function DragGhost() {
  const { source, x, y, returning } = useDrag()
  if (!source) return null
  // lifted above the finger while dragging so the coin stays visible; centered when landing back
  const dy = returning ? ORB / 2 : ORB * 0.9
  return (
    <div
      className={`ghost${returning ? ' returning' : ''}`}
      style={{ transform: `translate3d(${x - ORB / 2}px, ${y - dy}px, 0)` }}
    >
      <Orb entity={source} />
    </div>
  )
}
