import { useEffect } from 'react'
import { Board } from './components/Board'
import { useOnline } from './hooks/useOnline'
import { supabase, supabaseConfigured } from './lib/supabase'
import { Auth } from './pages/Auth'
import { Onboarding } from './pages/Onboarding'
import { useBudget } from './store/budget'

export function App() {
  const status = useBudget((s) => s.status)
  const setSession = useBudget((s) => s.setSession)
  const online = useOnline()

  useEffect(() => {
    if (!supabaseConfigured) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // token refreshes don't change who is signed in; avoid a full reload for them
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // defer: supabase-js forbids awaiting its own calls inside this callback
        setTimeout(() => void setSession(session), 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [setSession])

  if (!supabaseConfigured) {
    return <div className="splash">Не заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY</div>
  }

  return (
    <>
      {status === 'loading' && <div className="splash">Загрузка…</div>}
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
