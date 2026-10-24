import { Plus } from 'lucide-react'
import { useDrag, useCoinDrag, useDropRole } from '../hooks/useCoinDrag'
import { iconFor } from '../lib/icons'
import { formatRubShort } from '../lib/money'
import { canDragFrom } from '../lib/rules'
import type { Entity } from '../lib/types'

export function CoinFace({ entity, level = 0, over = false }: { entity: Entity; level?: number; over?: boolean }) {
  const Icon = iconFor(entity.icon)
  const expense = entity.kind === 'expense'
  return (
    <span className={`coin${expense ? ' expense' : ''}${over ? ' over-plan' : ''}`}>
      {expense && level > 0 && <span className="level" style={{ height: `${Math.min(level, 1) * 100}%` }} />}
      {!expense && <span className="tint" style={{ background: entity.color }} />}
      <Icon size={26} strokeWidth={1.8} color={expense ? entity.color : undefined} />
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
  const level = entity.kind === 'expense' && plan ? total / plan : 0
  const over = entity.kind === 'expense' && plan != null && total > plan

  return (
    <button
      ref={ref}
      type="button"
      data-entity-id={entity.id}
      className={`coin-cell${canDragFrom(entity.kind) ? ' draggable' : ''}${role ? ` role-${role}` : ''}`}
      // pointer taps are handled by the drag hook; this keeps keyboard access
      onClick={(e) => e.detail === 0 && onTap(entity)}
    >
      <span className="coin-name">{entity.name}</span>
      <CoinFace entity={entity} level={level} over={over} />
      <span className={`coin-amount${total < 0 ? ' neg' : ''}`}>{formatRubShort(total)}</span>
      {plan != null && <span className="coin-plan">из {formatRubShort(plan)}</span>}
    </button>
  )
}

export function AddTile({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button type="button" className="coin-cell add-tile" onClick={onClick} aria-label={label}>
      <span className="coin-name">{label}</span>
      <span className="coin">
        <Plus size={26} />
      </span>
    </button>
  )
}

export function DragGhost() {
  const { source, x, y } = useDrag()
  if (!source) return null
  return (
    <div className="ghost" style={{ left: x, top: y }}>
      <CoinFace entity={source} />
    </div>
  )
}
