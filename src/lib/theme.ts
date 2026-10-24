import { useSyncExternalStore } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
type Theme = 'light' | 'dark'

// Same key and colors are used by the inline script in index.html (applied before first paint).
const KEY = 'bk.theme'
const BAR_COLOR: Record<Theme, string> = { light: '#faf9f5', dark: '#181715' }

const media = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

let current: ThemePref = readPref()

function resolve(pref: ThemePref): Theme {
  return pref === 'system' ? (media.matches ? 'dark' : 'light') : pref
}

function apply(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  // status bar / Android toolbar color
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = pref === 'system' ? BAR_COLOR[m.media.includes('dark') ? 'dark' : 'light'] : BAR_COLOR[pref]
  })
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    // storage unavailable: the choice lasts until reload
  }
  const changes = resolve(pref) !== resolve(current)
  current = pref
  const run = () => apply(pref)
  // cross-fade instead of an abrupt brightness jump
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (changes && !reduce && 'startViewTransition' in document) document.startViewTransition(run)
  else run()
  listeners.forEach((l) => l())
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

apply(current)
