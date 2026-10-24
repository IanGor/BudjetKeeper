import { Wallet } from 'lucide-react'
import { useState, type CSSProperties, type FormEvent } from 'react'
import { errorText, supabase } from '../lib/supabase'

// Sign-ups are closed on the server (the budget is for two people), so only sign-in is offered.
export function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(errorText(error))
    setBusy(false)
  }

  return (
    <div className="center-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="logo">
          <span className="orb solid" style={{ '--c': '#2b7cf2' } as CSSProperties}>
            <Wallet strokeWidth={2} />
          </span>
          <h1>BudjetKeeper</h1>
          <p>Общий бюджет на двоих</p>
        </div>

        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Пароль</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="btn-row">
          <button type="submit" className="btn" disabled={busy}>
            Войти
          </button>
        </div>
        <p className="hint">Регистрация закрыта</p>
      </form>
    </div>
  )
}
