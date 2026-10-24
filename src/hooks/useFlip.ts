import { useLayoutEffect, useRef, type RefObject } from 'react'

/**
 * FLIP: when `key` (the display order) changes, every [data-flip-id] child that
 * moved glides from its old place instead of jumping. Positions are taken
 * relative to the offset parent, so scrolling a row or pager is not a "move".
 */
export function useFlip(ref: RefObject<HTMLElement | null>, key: string) {
  const prev = useRef(new Map<string, { parent: Element | null; x: number; y: number }>())

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const next = new Map<string, { parent: Element | null; x: number; y: number }>()
    root.querySelectorAll<HTMLElement>('[data-flip-id]').forEach((el) => {
      const id = el.dataset.flipId!
      const now = { parent: el.offsetParent, x: el.offsetLeft, y: el.offsetTop }
      next.set(id, now)
      const was = prev.current.get(id)
      if (!was || reduce || was.parent !== now.parent) return
      const dx = was.x - now.x
      const dy = was.y - now.y
      if (Math.abs(dx) + Math.abs(dy) < 1) return
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: 320,
        easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
      })
    })
    prev.current = next
  }, [ref, key])
}
