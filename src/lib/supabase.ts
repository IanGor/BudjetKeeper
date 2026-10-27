import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

const REQUEST_TIMEOUT_MS = 15000

/** A request that never answers (bad network, throttled host) must fail, not hang the app. */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const caller = init?.signal
  if (caller) {
    if (caller.aborted) controller.abort()
    else caller.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true },
  global: { fetch: fetchWithTimeout },
})

/** Human-readable message for Supabase/PostgREST errors raised by our SQL. */
export function errorText(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err)
  if (msg.includes('Invalid login credentials')) return 'Неверный email или пароль'
  if (msg.includes('User already registered')) return 'Такой пользователь уже есть'
  if (msg.includes('Password should be')) return 'Пароль слишком короткий (минимум 6 символов)'
  if (msg.includes('invite code not found')) return 'Код приглашения не найден'
  if (msg.includes('household is full')) return 'В бюджете уже максимум участников'
  if (/signups? not allowed|signup_disabled/i.test(msg)) return 'Регистрация закрыта'
  if (msg.includes('already a member')) return 'Вы уже состоите в бюджете'
  if (msg.includes('is not allowed')) return 'Такая операция невозможна'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'Нет связи с сервером'
  return msg
}
