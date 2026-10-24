import { Wallet } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { errorText, supabase } from '../lib/supabase'

export function Auth() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    if (mode === 'signIn') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setError(errorText(error))
    } else {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
      if (error) setError(errorText(error))
      // email confirmation enabled on the project: no session until the link is opened
      else if (!data.session) setInfo('Мы отправили письмо со ссылкой. Подтвердите email и войдите.')
    }
    setBusy(false)
  }

  return (
    <form className="center-page" onSubmit={submit}>
      <div className="logo">
        <span className="coin">
          <Wallet size={34} />
        </span>
        <h1>BudjetKeeper</h1>
      </div>

      <div className="tabs">
        <button type="button" className={mode === 'signIn' ? 'on' : ''} onClick={() => setMode('signIn')}>
          Вход
        </button>
        <button type="button" className={mode === 'signUp' ? 'on' : ''} onClick={() => setMode('signUp')}>
          Регистрация
        </button>
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
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error && <p className="error">{error}</p>}
      {info && <p className="hint">{info}</p>}

      <div className="btn-row">
        <button type="submit" className="btn" disabled={busy}>
          {mode === 'signIn' ? 'Войти' : 'Создать аккаунт'}
        </button>
      </div>
    </form>
  )
}
