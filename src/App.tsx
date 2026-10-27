import { useEffect } from 'react'
import { Board } from './components/Board'
import { useOnline } from './hooks/useOnline'
import { supabase, supabaseConfigured } from './lib/supabase'
import { Auth } from './pages/Auth'
import { Onboarding } from './pages/Onboarding'
import { useBudget } from './store/budget'

const LOADING_LIMIT_MS = 20000

export function App() {
  const status = useBudget((s) => s.status)
  const setSession = useBudget((s) => s.setSession)
  const markFailed = useBudget((s) => s.markFailed)
  const retry = useBudget((s) => s.retry)
  const online = useOnline()

  useEffect(() => {
    if (!supabaseConfigured) return
    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(markFailed)
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // token refreshes don't change who is signed in; avoid a full reload for them
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // defer: supabase-js forbids awaiting its own calls inside this callback
        setTimeout(() => void setSession(session), 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [setSession, markFailed])

  // last resort: whatever hangs (a stuck request, a locked token), the splash never lasts forever
  useEffect(() => {
    if (status !== 'loading') return
    const t = setTimeout(markFailed, LOADING_LIMIT_MS)
    return () => clearTimeout(t)
  }, [status, markFailed])

  if (!supabaseConfigured) {
    return <div className="splash">Не заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY</div>
  }

  return (
    <>
      {status === 'loading' && <div className="splash">Загрузка…</div>}
      {status === 'failed' && (
        <div className="splash">
          <div className="splash-failed">
            <p>Не удаётся связаться с сервером</p>
            <button type="button" className="btn" onClick={() => void retry()}>
              Повторить
            </button>
            <button type="button" className="link" onClick={() => void supabase.auth.signOut()}>
              Выйти
            </button>
          </div>
        </div>
      )}
      {status === 'signedOut' && <Auth />}
      {status === 'onboarding' && <Onboarding />}
      {status === 'ready' && <Board />}
      {!online && <div className="offline">Нет связи — изменения недоступны</div>}
      <Toast />
    </>
  )
}

function Toast() {
  const toast = useBudget((s) => s.toast)
  const clearToast = useBudget((s) => s.clearToast)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(clearToast, 3500)
    return () => clearTimeout(t)
  }, [toast, clearToast])
  if (!toast) return null
  return (
    <div className="toast" role="alert" onClick={clearToast}>
      {toast}
    </div>
  )
}
