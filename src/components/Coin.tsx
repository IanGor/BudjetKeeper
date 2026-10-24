import { Plus } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useArrange } from '../hooks/useArrange'
import { useDrag, useCoinDrag, useDropRole } from '../hooks/useCoinDrag'
import { iconFor } from '../lib/icons'
import { formatRubShort } from '../lib/money'
import { canDragFrom } from '../lib/rules'
import type { Entity } from '../lib/types'

interface OrbProps {
  entity: Entity
  /** plan fulfilment 0..n; draws a ring when set */
  progress?: number
  over?: boolean
}

/** Income sources and accounts are flat discs of their color; categories are a light tint with a colored glyph. */
export function Orb({ entity, progress, over = false }: OrbProps) {
  const Icon = iconFor(entity.icon)
  const value = progress === undefined ? 0 : Math.min(Math.max(progress, 0), 1) * 100
  return (
    <span
      className={`orb ${entity.kind === 'expense' ? 'tinted' : 'solid'}`}
      style={{ '--c': entity.color } as CSSProperties}
    >
      {progress !== undefined && (
        <svg className={`ring${over ? ' over' : ''}`} viewBox="0 0 68 68" aria-hidden="true">
          <circle className="track" cx="34" cy="34" r="32" />
          {value > 0 && <circle className="value" cx="34" cy="34" r="32" pathLength={100} strokeDasharray={`${value} 100`} />}
        </svg>
      )}
      <Icon strokeWidth={2} />
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
  const over = entity.kind === 'expense' && hasPlan && total > plan

  return (
    <button
      ref={ref}
      type="button"
      data-entity-id={entity.id}
      className={`coin-cell${canDragFrom(entity.kind) ? ' draggable' : ''}${role ? ` role-${role}` : ''}`}
      // pointer taps are handled by the drag hook; this keeps keyboard access
      onClick={(e) => e.detail === 0 && !useArrange.getState().editing && onTap(entity)}
    >
      <Orb entity={entity} progress={hasPlan ? total / plan : undefined} over={over} />
      <span className="coin-name">{entity.name}</span>
      <span className={`coin-amount${total < 0 ? ' neg' : ''}`}>{formatRubShort(total)}</span>
      {hasPlan && <span className="coin-plan">из {formatRubShort(plan)}</span>}
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
