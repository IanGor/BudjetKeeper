import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { canDragFrom, canFlow } from '../lib/rules'
import type { Entity } from '../lib/types'
import { commitOrder, moveOver, startEditing, useArrange } from './useArrange'

interface DragState {
  source: Entity | null
  x: number
  y: number
  overId: string | null
  /** released over nothing: the ghost travels back to its coin (same path out and in) */
  returning: boolean
  /** the drag rearranges coins (edit mode) instead of moving money */
  reorder: boolean
}

export const useDrag = create<DragState>(() => ({
  source: null,
  x: 0,
  y: 0,
  overId: null,
  returning: false,
  reorder: false,
}))

export const RETURN_MS = 340

export type DropRole = 'source' | 'placeholder' | 'over' | 'valid' | 'invalid' | null

/** How a coin should look while something is being dragged. */
export function useDropRole(entity: Entity): DropRole {
  return useDrag((s) => {
    if (!s.source) return null
    // while rearranging, the dragged coin leaves an empty slot behind it
    if (s.reorder) return s.source.id === entity.id ? 'placeholder' : null
    if (s.source.id === entity.id) return 'source'
    if (s.returning) return null
    if (!canFlow(s.source.kind, entity.kind)) return 'invalid'
    return s.overId === entity.id ? 'over' : 'valid'
  })
}

const MOVE_THRESHOLD = 6
const LONG_PRESS_MS = 200 // hold to pick up money
const EDIT_PRESS_MS = 550 // keep holding without moving: edit mode (like the iOS home screen)
const EDGE = 32
const EDGE_FLIP_MS = 550

interface Options {
  entity: Entity
  entities: Record<string, Entity>
  onTap(entity: Entity): void
  onDrop(from: Entity, to: Entity): void
}

/**
 * Pointer-based drag of a coin.
 *
 * Normal mode: drag onto another coin to record money flow. Source coins use
 * `touch-action: pan-x`, so a horizontal swipe still scrolls the row natively
 * (the browser then sends pointercancel). A vertical move or a short hold
 * starts the drag; from then on touchmove is prevented so the page cannot
 * scroll under the finger (needed on iOS Safari).
 *
 * A longer still hold enters edit mode; the same finger can then drag the
 * coin to a new place in its section, as can any later touch while editing.
 */
export function useCoinDrag({ entity, entities, onTap, onDrop }: Options) {
  const ref = useRef<HTMLButtonElement>(null)
  const opts = useRef({ entity, entities, onTap, onDrop })
  opts.current = { entity, entities, onTap, onDrop }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const draggable = canDragFrom(opts.current.entity.kind)

    let pointerId: number | null = null
    let startX = 0
    let startY = 0
    let mode: 'money' | 'reorder' = 'money'
    let active = false
    let moved = false
    let holding = false // edit mode entered under the finger: keep the page from scrolling
    let pressTimer = 0
    let editTimer = 0
    let edgeTimer = 0
    let returnTimer = 0
    let edgeKey = ''
    let lastOver: string | null = null

    const activate = (x: number, y: number) => {
      if (active) return
      active = true
      lastOver = null
      window.clearTimeout(pressTimer)
      window.clearTimeout(returnTimer)
      navigator.vibrate?.(12)
      useDrag.setState({ source: opts.current.entity, x, y, overId: null, returning: false, reorder: mode === 'reorder' })
    }

    const enterEdit = () => {
      if (moved) return
      window.clearTimeout(pressTimer)
      // a money drag picked up at 200 ms gives way to edit mode
      if (active) useDrag.setState({ source: null, overId: null, returning: false, reorder: false })
      active = false
      holding = true
      mode = 'reorder'
      startEditing()
    }

    const entityAt = (x: number, y: number): Entity | null => {
      const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-entity-id]')
      const target = hit ? opts.current.entities[hit.dataset.entityId!] : undefined
      return target && target.id !== opts.current.entity.id ? target : null
    }

    const targetAt = (x: number, y: number): Entity | null => {
      const target = entityAt(x, y)
      return target && canFlow(opts.current.entity.kind, target.kind) ? target : null
    }

    // flip pages / scroll rows when hovering near the edge of a scroll area
    const edgeScroll = (x: number, y: number) => {
      const area = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drag-scroll]')
      let key = ''
      let dir = 0
      if (area) {
        const r = area.getBoundingClientRect()
        if (x < r.left + EDGE) dir = -1
        else if (x > r.right - EDGE) dir = 1
        if (dir) key = `${area.dataset.dragScroll}:${dir}`
      }
      if (key === edgeKey) return
      edgeKey = key
      window.clearInterval(edgeTimer)
      if (area && dir) {
        edgeTimer = window.setInterval(
          () => area.scrollBy({ left: dir * area.clientWidth, behavior: 'smooth' }),
          EDGE_FLIP_MS,
        )
      }
    }

    const reset = (clearGhost = true) => {
      window.clearTimeout(pressTimer)
      window.clearTimeout(editTimer)
      window.clearInterval(edgeTimer)
      edgeKey = ''
      pointerId = null
      holding = false
      if (active && clearGhost) useDrag.setState({ source: null, overId: null, returning: false, reorder: false })
      active = false
    }

    const returnGhost = () => {
      const orb = el.querySelector('.orb')?.getBoundingClientRect()
      if (!orb || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        reset()
        return
      }
      reset(false)
      useDrag.setState({ x: orb.left + orb.width / 2, y: orb.top + orb.height / 2, overId: null, returning: true })
      returnTimer = window.setTimeout(
        () => useDrag.setState({ source: null, returning: false, reorder: false }),
        RETURN_MS,
      )
    }

    const onPointerDown = (e: PointerEvent) => {
      if (pointerId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return
      pointerId = e.pointerId
      startX = e.clientX
      startY = e.clientY
      moved = false
      active = false
      mode = useArrange.getState().editing ? 'reorder' : 'money'
      if (mode === 'money') {
        if (draggable) pressTimer = window.setTimeout(() => activate(startX, startY), LONG_PRESS_MS)
        editTimer = window.setTimeout(enterEdit, EDIT_PRESS_MS)
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      // any real movement (even after a hold picked the coin up) means "drag", not "edit mode"
      if (!moved && Math.hypot(dx, dy) >= MOVE_THRESHOLD) {
        moved = true
        window.clearTimeout(pressTimer)
        window.clearTimeout(editTimer)
      }
      if (!active) {
        if (!moved) return
        if (mode === 'money') {
          // horizontal touch swipes belong to the scroll row
          if (!draggable || (e.pointerType === 'touch' && Math.abs(dx) > Math.abs(dy))) return
        }
        activate(e.clientX, e.clientY)
      }

      if (mode === 'reorder') {
        const target = entityAt(e.clientX, e.clientY)
        // react once per target: the slots shift under the finger after a move
        if (target && target.id !== lastOver) moveOver(opts.current.entity, target)
        lastOver = target?.id ?? lastOver
        useDrag.setState({ x: e.clientX, y: e.clientY })
        edgeScroll(e.clientX, e.clientY)
        return
      }

      const target = targetAt(e.clientX, e.clientY)
      const overId = target?.id ?? null
      // a light tick when the coin snaps onto a new target (Android; iOS has no Vibration API)
      if (overId && overId !== lastOver) navigator.vibrate?.(5)
      lastOver = overId
      useDrag.setState({ x: e.clientX, y: e.clientY, overId })
      edgeScroll(e.clientX, e.clientY)
    }

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      if (mode === 'reorder') {
        // taps do nothing while editing, as on the home screen
        if (active) {
          commitOrder()
          returnGhost()
        } else reset()
        return
      }
      if (active) {
        const target = targetAt(e.clientX, e.clientY)
        if (target) {
          navigator.vibrate?.(10)
          opts.current.onDrop(opts.current.entity, target)
        } else {
          returnGhost()
          return
        }
      } else if (!moved) {
        opts.current.onTap(opts.current.entity)
      }
      reset()
    }

    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      if (mode === 'reorder' && active) commitOrder()
      reset()
    }

    const onTouchMove = (e: TouchEvent) => {
      if ((active || holding) && e.cancelable) e.preventDefault()
    }
    const onContextMenu = (e: Event) => e.preventDefault()

    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('contextmenu', onContextMenu)
    return () => {
      reset()
      window.clearTimeout(returnTimer)
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('contextmenu', onContextMenu)
    }
  }, [])

  return ref
}
