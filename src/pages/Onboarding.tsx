import { Users } from 'lucide-react'
import { useState, type CSSProperties, type FormEvent } from 'react'
import { errorText, supabase } from '../lib/supabase'
import { useBudget } from '../store/budget'

export function Onboarding() {
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [displayName, setDisplayName] = useState('')
  const [householdName, setHouseholdName] = useState('Наш бюджет')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadAll = useBudget((s) => s.loadAll)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } =
      mode === 'create'
        ? await supabase.rpc('create_household', { p_name: householdName, p_display_name: displayName })
        : await supabase.rpc('join_household', { p_invite_code: code, p_display_name: displayName })
    if (error) {
      setError(errorText(error))
      setBusy(false)
      return
    }
    await loadAll()
    setBusy(false)
  }

  return (
    <div className="center-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="logo">
          <span className="orb solid" style={{ '--c': '#2b7cf2' } as CSSProperties}>
            <Users strokeWidth={2} />
          </span>
          <h1>Общий бюджет</h1>
          <p>Создайте новый или присоединитесь по коду</p>
        </div>

        <div className="segmented">
          <button type="button" className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>
            Создать
          </button>
          <button type="button" className={mode === 'join' ? 'on' : ''} onClick={() => setMode('join')}>
            Присоединиться
          </button>
        </div>

        <label className="field">
          <span>Ваше имя</span>
          <input className="input" required maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>

        {mode === 'create' ? (
          <label className="field">
            <span>Название бюджета</span>
            <input className="input" required maxLength={60} value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
          </label>
        ) : (
          <label className="field">
            <span>Код приглашения</span>
            <input
              className="input"
              required
              autoCapitalize="characters"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>
        )}

        {error && <p className="error">{error}</p>}

        <div className="btn-row">
          <button type="submit" className="btn" disabled={busy}>
            {mode === 'create' ? 'Создать бюджет' : 'Присоединиться'}
          </button>
        </div>
        <p className="hint">
          {mode === 'create'
            ? 'Будут созданы стартовые счета и категории — их можно изменить.'
            : 'Код есть в настройках у того, кто создал бюджет.'}
        </p>
        <p className="hint">
          <button type="button" className="link" onClick={() => void supabase.auth.signOut()}>
            Выйти
          </button>
        </p>
      </form>
    </div>
  )
}
