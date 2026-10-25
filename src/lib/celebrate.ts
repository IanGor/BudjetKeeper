/**
 * The small reward of a spending: as the sheet goes, a quiet coin clink, the
 * category's orb springs as if the coin fell in, and its fill rises to the new level.
 */

// the sheet is gone and the board has rendered the new total
const LAND_MS = 80

let audio: AudioContext | null = null

/** Two soft "ting"s, the second one quieter: a coin dropped and settling. */
function clink(ctx: AudioContext, at: number) {
  const out = ctx.createGain()
  out.gain.value = 0.07
  out.connect(ctx.destination)
  const ting = (t: number, level: number) => {
    // a metal disc rings with inharmonic partials that die out fast, the high ones first
    for (const [freq, gain, decay] of [
      [2093, 1, 0.38],
      [3220, 0.45, 0.24],
      [5310, 0.2, 0.12],
    ]) {
      const osc = ctx.createOscillator()
      osc.frequency.value = freq
      const env = ctx.createGain()
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(gain * level, t + 0.004)
      env.gain.exponentialRampToValueAtTime(0.0001, t + decay)
      osc.connect(env).connect(out)
      osc.start(t)
      osc.stop(t + decay + 0.02)
    }
  }
  ting(at, 1)
  ting(at + 0.09, 0.4)
}

/** Call from the tap that saves the operation: browsers start audio only from a user gesture. */
export function celebrateDrop(entityId: string) {
  try {
    audio ??= new AudioContext()
    void audio.resume()
    clink(audio, audio.currentTime + LAND_MS / 1000)
  } catch {
    // no Web Audio: the coin lands silently
  }

  const orb = document.querySelector<HTMLElement>(`[data-entity-id="${CSS.escape(entityId)}"] .orb`)
  if (!orb || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  orb.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(0.86)', offset: 0.22 },
      { transform: 'scale(1.07)', offset: 0.55 },
      { transform: 'scale(0.98)', offset: 0.8 },
      { transform: 'scale(1)' },
    ],
    { duration: 560, delay: LAND_MS, easing: 'ease-out' },
  )

  // from the level it had to the new one (set by the next render), with a little overshoot;
  // the fill's own CSS transition would win over this animation, so it is off meanwhile
  const fill = orb.querySelector<HTMLElement>('.orb-fill')
  if (!fill) return
  fill.style.transition = 'none'
  const rise = fill.animate([{ height: `${fill.offsetHeight}px`, offset: 0 }], {
    duration: 750,
    delay: LAND_MS + 120,
    easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
    fill: 'backwards',
  })
  const restore = () => (fill.style.transition = '')
  rise.finished.then(restore, restore)
}
