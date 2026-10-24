import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { canDragFrom, canFlow } from '../lib/rules'
import type { Entity } from '../lib/types'

interface DragState {
  source: Entity | null
  x: number
  y: number
  overId: string | null
}

export const useDrag = create<DragState>(() => ({ source: null, x: 0, y: 0, overId: null }))

export type DropRole = 'source' | 'over' | 'valid' | 'invalid' | null

/** How a coin should look while something is being dragged. */
export function useDropRole(entity: Entity): DropRole {
  return useDrag((s) => {
    if (!s.source) return null
    if (s.source.id === entity.id) return 'source'
    if (!canFlow(s.source.kind, entity.kind)) return 'invalid'
    return s.overId === entity.id ? 'over' : 'valid'
  })
}

const MOVE_THRESHOLD = 6
const LONG_PRESS_MS = 200
const EDGE = 32
const EDGE_FLIP_MS = 550

interface Options {
  entity: Entity
  entities: Record<string, Entity>
  onTap(entity: Entity): void
  onDrop(from: Entity, to: Entity): void
}

/**
 * Pointer-based drag of a coin onto another coin.
 * Source coins use `touch-action: pan-x`, so a horizontal swipe still scrolls
 * the row natively (the browser then sends pointercancel). A vertical move or
 * a short hold starts the drag; from then on touchmove is prevented so the
 * page cannot scroll under the finger (needed on iOS Safari).
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
    let active = false
    let moved = false
    let pressTimer = 0
    let edgeTimer = 0
    let edgeKey = ''

    const activate = (x: number, y: number) => {
      if (active) return
      active = true
      window.clearTimeout(pressTimer)
      navigator.vibrate?.(12)
      useDrag.setState({ source: opts.current.entity, x, y, overId: null })
    }

    const targetAt = (x: number, y: number): Entity | null => {
      const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-entity-id]')
      const target = hit ? opts.current.entities[hit.dataset.entityId!] : undefined
      if (!target || target.id === opts.current.entity.id) return null
      return canFlow(opts.current.entity.kind, target.kind) ? target : null
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

    const reset = () => {
      window.clearTimeout(pressTimer)
      window.clearInterval(edgeTimer)
      edgeKey = ''
      pointerId = null
      if (active) useDrag.setState({ source: null, overId: null })
      active = false
    }

    const onPointerDown = (e: PointerEvent) => {
      if (pointerId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return
      pointerId = e.pointerId
      startX = e.clientX
      startY = e.clientY
      moved = false
      active = false
      if (draggable) pressTimer = window.setTimeout(() => activate(startX, startY), LONG_PRESS_MS)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (!active) {
        if (Math.hypot(dx, dy) < MOVE_THRESHOLD) return
        moved = true
        window.clearTimeout(pressTimer)
        // horizontal touch swipes belong to the scroll row
        if (!draggable || (e.pointerType === 'touch' && Math.abs(dx) > Math.abs(dy))) return
        activate(e.clientX, e.clientY)
      }
      const target = targetAt(e.clientX, e.clientY)
      useDrag.setState({ x: e.clientX, y: e.clientY, overId: target?.id ?? null })
      edgeScroll(e.clientX, e.clientY)
    }

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      if (active) {
        const target = targetAt(e.clientX, e.clientY)
        if (target) opts.current.onDrop(opts.current.entity, target)
      } else if (!moved) {
        opts.current.onTap(opts.current.entity)
      }
      reset()
    }

    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerId === pointerId) reset()
    }

    const onTouchMove = (e: TouchEvent) => {
      if (active && e.cancelable) e.preventDefault()
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
