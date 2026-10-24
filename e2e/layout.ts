import type { Locator, Page } from '@playwright/test'

export interface Box {
  text: string
  x: number
  y: number
  w: number
  h: number
}

/**
 * Visible boxes of every element under `root` that holds text directly,
 * clipped by ancestors that hide overflow (a line-clamped name, a scrolled row).
 */
export function textBoxes(root: Locator): Promise<Box[]> {
  return root.evaluate((rootEl) => {
    const out: Box[] = []
    const all = [rootEl, ...rootEl.querySelectorAll('*')] as HTMLElement[]
    for (const el of all) {
      const text = [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent!.trim())
        .join(' ')
        .trim()
      if (!text) continue
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || Number(style.opacity) === 0) continue
      let r = el.getBoundingClientRect()
      let left = r.left
      let top = r.top
      let right = r.right
      let bottom = r.bottom
      for (let a = el.parentElement; a; a = a.parentElement) {
        const s = getComputedStyle(a)
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
          r = a.getBoundingClientRect()
          left = Math.max(left, r.left)
          top = Math.max(top, r.top)
          right = Math.min(right, r.right)
          bottom = Math.min(bottom, r.bottom)
        }
      }
      if (right - left < 1 || bottom - top < 1) continue
      out.push({ text, x: left, y: top, w: right - left, h: bottom - top })
    }
    return out
  })
}

/** Pairs of text boxes that cover each other by more than `tolerance` px both ways. */
export function overlaps(boxes: Box[], tolerance = 1): string[] {
  const found: string[] = []
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      if (dx > tolerance && dy > tolerance) found.push(`«${a.text}» × «${b.text}»`)
    }
  }
  return found
}

/** Text that is cut without an ellipsis: wider or taller than its own box. */
export function clippedText(root: Locator): Promise<string[]> {
  return root.evaluate((rootEl) =>
    ([...rootEl.querySelectorAll('.coin-amount, .coin-plan, .section-title, .section-meta, .large-title, h2, .subtitle, .key, .btn')] as HTMLElement[])
      .filter((el) => el.offsetParent !== null && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1))
      .map((el) => el.textContent ?? ''),
  )
}

export async function viewportOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
}

/** Alpha of the computed background color of an element. */
export function backgroundAlpha(el: Locator): Promise<number> {
  return el.evaluate((e) => {
    const c = getComputedStyle(e).backgroundColor
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (!m) return 1
    const parts = m[1].split(/[ ,/]+/).filter(Boolean)
    return parts.length === 4 ? Number(parts[3]) : 1
  })
}
