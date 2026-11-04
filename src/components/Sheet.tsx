import { X } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

interface SheetProps {
  title: ReactNode
  subtitle?: ReactNode
  /** shown left of the title (e.g. the entity's orb) */
  leading?: ReactNode
  onClose(): void
  className?: string
  dismissDisabled?: boolean
  children: ReactNode
}

const CLOSE_MS = 260

// Apple's momentum projection (Designing Fluid Interfaces): where a flick would come to rest.
const project = (velocity: number, decel = 0.998) => ((velocity / 1000) * decel) / (1 - decel)
// progressive resistance past the top edge instead of a hard stop
const rubberband = (over: number, size: number, c = 0.55) => (over * size * c) / (size + c * Math.abs(over))

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Sheet({ title, subtitle, leading, onClose, children, className = '', dismissDisabled = false }: SheetProps) {
  const titleId = useId()
  const [closing, setClosing] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; startY: number; samples: { y: number; t: number }[] } | null>(null)

  // exits along the path it came in (slides back down)
  const dismiss = useCallback(() => {
    if (closing || dismissDisabled) return
    setClosing(true)
    window.setTimeout(onClose, reducedMotion() ? 0 : CLOSE_MS)
  }, [closing, onClose, dismissDisabled])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const background: { element: HTMLElement; inert: boolean }[] = []
    let branch = backdropRef.current as HTMLElement
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          background.push({ element: sibling, inert: sibling.inert })
          sibling.inert = true
        }
      }
      branch = branch.parentElement
    }
    const sheet = sheetRef.current!
    const focusable = () => Array.from(sheet.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'))
      .filter((el) => !el.closest('fieldset:disabled') && el.getClientRects().length > 0)
    const isTop = () => Array.from(document.querySelectorAll('[role="dialog"]')).at(-1) === sheet
    if (!sheet.contains(document.activeElement)) (focusable()[0] ?? sheet).focus()
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !isTop()) return
      const fields = focusable()
      const index = fields.indexOf(document.activeElement as HTMLElement)
      if (!fields.length || index < 0 || (!event.shiftKey && index === fields.length - 1) || (event.shiftKey && index === 0)) {
        event.preventDefault()
        ;(event.shiftKey ? fields.at(-1) ?? sheet : fields[0] ?? sheet).focus()
      }
    }
    const containProgrammaticFocus = () => {
      if (isTop() && !sheet.contains(document.activeElement)) (focusable()[0] ?? sheet).focus()
    }
    document.addEventListener('focusin', containProgrammaticFocus)
    document.addEventListener('keydown', containFocus)
    return () => {
      document.removeEventListener('keydown', containFocus)
      document.removeEventListener('focusin', containProgrammaticFocus)
      for (const { element, inert } of background) element.inert = inert
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  // On-screen keyboards cover the page instead of resizing it (Chrome on Android,
  // Safari): the browser then pans the whole page to the focused field and the sheet's
  // top goes off screen. The backdrop follows the visible part of the page, so the
  // sheet shrinks above the keyboard and scrolls inside, header kept.
  useEffect(() => {
    const vv = window.visualViewport
    const backdrop = backdropRef.current
    if (!vv || !backdrop) return
    const fit = () => {
      backdrop.style.top = `${vv.offsetTop}px`
      backdrop.style.height = `${vv.height}px`
      const field = document.activeElement
      if (field instanceof HTMLInputElement && backdrop.contains(field)) field.scrollIntoView({ block: 'nearest' })
    }
    fit()
    vv.addEventListener('resize', fit)
    vv.addEventListener('scroll', fit)
    return () => {
      vv.removeEventListener('resize', fit)
      vv.removeEventListener('scroll', fit)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismiss()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dismiss])

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as Element).closest('button') || closing || dismissDisabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, startY: e.clientY, samples: [{ y: e.clientY, t: e.timeStamp }] }
    const sheet = sheetRef.current!
    sheet.style.transition = 'none'
    sheet.style.animation = 'none'
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    d.samples.push({ y: e.clientY, t: e.timeStamp })
    if (d.samples.length > 5) d.samples.shift()
    const dy = e.clientY - d.startY
    const sheet = sheetRef.current!
    const offset = dy >= 0 ? dy : -rubberband(-dy, sheet.offsetHeight)
    sheet.style.transform = `translateY(${offset}px)`
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    const sheet = sheetRef.current!
    const first = d.samples[0]
    const last = d.samples[d.samples.length - 1]
    const velocity = last.t > first.t ? ((last.y - first.y) / (last.t - first.t)) * 1000 : 0
    const offset = Math.max(0, e.clientY - d.startY)
    const projected = offset + project(velocity)

    // velocity carries into the settle animation, so there is no seam between drag and motion
    sheet.style.transition = `transform ${CLOSE_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`
    if (projected > sheet.offsetHeight * 0.45) {
      sheet.style.transform = 'translateY(110%)'
      setClosing(true)
      window.setTimeout(onClose, CLOSE_MS)
    } else {
      sheet.style.transition = 'transform 420ms cubic-bezier(0.34, 1.2, 0.64, 1)'
      sheet.style.transform = ''
    }
  }

  return (
    <div
      ref={backdropRef}
      className={`backdrop${closing ? ' closing' : ''}`}
      onPointerDown={(e) => e.target === e.currentTarget && dismiss()}
    >
      <div
        ref={sheetRef}
        className={`sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        // scroll-edge effect: the sticky header gets its material only once content runs under it
        onScroll={(e) => e.currentTarget.toggleAttribute('data-scrolled', e.currentTarget.scrollTop > 2)}
      >
        <div
          className="sheet-top"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="grabber" />
          <div className="sheet-head">
            {leading}
            <div className="titles">
              <h2 id={titleId}>{title}</h2>
              {subtitle && <div className="subtitle">{subtitle}</div>}
            </div>
            <button type="button" className="close-btn" onClick={dismiss} aria-label="Закрыть" disabled={dismissDisabled}>
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
