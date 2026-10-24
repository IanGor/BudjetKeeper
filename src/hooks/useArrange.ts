import { create } from 'zustand'
import { moveId } from '../lib/order'
import type { Entity, EntityKind } from '../lib/types'
import { selectKind, useBudget } from '../store/budget'

/**
 * Home-screen style "edit mode": coins wiggle, show a hide badge and can be
 * dragged to a new place within their section. While dragging, `draft` holds
 * the live order; it is saved when the coin is released.
 */
interface ArrangeState {
  editing: boolean
  draft: { kind: EntityKind; ids: string[] } | null
}

export const useArrange = create<ArrangeState>(() => ({ editing: false, draft: null }))

export function startEditing() {
  if (useArrange.getState().editing) return
  navigator.vibrate?.(20)
  useArrange.setState({ editing: true })
}

export function stopEditing() {
  useArrange.setState({ editing: false, draft: null })
}

/** Moves the dragged coin onto the slot of `target` (same section only). */
export function moveOver(source: Entity, target: Entity) {
  if (source.kind !== target.kind || source.id === target.id) return
  const { draft } = useArrange.getState()
  const ids =
    draft?.kind === source.kind ? draft.ids : selectKind(useBudget.getState().entities, source.kind).map((e) => e.id)
  const next = moveId(ids, source.id, target.id)
  if (next === ids) return
  navigator.vibrate?.(4)
  useArrange.setState({ draft: { kind: source.kind, ids: next } })
}

export function commitOrder() {
  const { draft } = useArrange.getState()
  if (!draft) return
  // the store applies positions optimistically, so clearing the draft causes no jump
  void useBudget.getState().reorder(draft.ids)
  useArrange.setState({ draft: null })
}

/** Visible entities of a kind in display order, honoring an in-progress drag. */
export function orderedKind(entities: Record<string, Entity>, kind: EntityKind, draft: ArrangeState['draft']): Entity[] {
  if (draft?.kind !== kind) return selectKind(entities, kind)
  return draft.ids.map((id) => entities[id]).filter((e): e is Entity => Boolean(e && !e.archived))
}
