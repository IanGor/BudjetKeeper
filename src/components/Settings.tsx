import { Check, ChevronRight, Copy, LogOut } from 'lucide-react'
import { useState } from 'react'
import { errorText, supabase } from '../lib/supabase'
import { setThemePref, useThemePref, type ThemePref } from '../lib/theme'
import { useBudget } from '../store/budget'
import { Orb } from './Coin'
import { RoundupSettings, roundupSummary } from './RoundupSettings'
import { Sheet } from './Sheet'

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Авто' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

export function Settings({ onClose }: { onClose(): void }) {
  const household = useBudget((s) => s.household)
  const members = useBudget((s) => s.members)
  const userId = useBudget((s) => s.userId)
  const entities = useBudget((s) => s.entities)
  const updateEntity = useBudget((s) => s.updateEntity)
  const loadMembers = useBudget((s) => s.loadMembers)
  const showToast = useBudget((s) => s.showToast)
  const theme = useThemePref()
  const me = members.find((m) => m.user_id === userId)
  const [name, setName] = useState(me?.display_name ?? '')
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState<'main' | 'roundup'>('main')

  // the code is useless once the budget is full; it reappears when max_members is raised
  const full = !household || members.length >= household.max_members
  const archived = Object.values(entities).filter((e) => e.archived)

  const copy = async () => {
    if (!household) return
    try {
      await navigator.clipboard.writeText(household.invite_code)
      setCopied(true)
    } catch {
      showToast('Не удалось скопировать, перепишите код вручную')
    }
  }

  const saveName = async () => {
    if (!household || !userId || !name.trim()) return
    const { error } = await supabase
      .from('household_members')
      .update({ display_name: name.trim() })
      .eq('household_id', household.id)
      .eq('user_id', userId)
    if (error) showToast(errorText(error))
    else void loadMembers()
  }

  if (view === 'roundup') return <RoundupSettings onBack={() => setView('main')} onClose={onClose} />

  return (
    <Sheet title="Настройки" subtitle={household?.name} onClose={onClose}>
      <div className="field">
        <span>Оформление</span>
        <div className="segmented" role="radiogroup" aria-label="Тема">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={theme === t.value}
              className={theme === t.value ? 'on' : ''}
              onClick={() => setThemePref(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {household && (
        <div className="field">
          <span>Деньги</span>
          <div className="list">
            <button type="button" className="list-row" onClick={() => setView('roundup')}>
              <span className="main">
                <div>Округление</div>
                <div className="sub">
                  {roundupSummary(household.roundup_account_id ? entities[household.roundup_account_id]?.name : undefined, household.roundup_step)}
                </div>
              </span>
              <ChevronRight size={18} className="chev" />
            </button>
          </div>
        </div>
      )}

      {!full && (
        <div className="field">
          <span>Код приглашения</span>
          <div className="list">
            <div className="list-row">
              <span className="invite">{household?.invite_code}</span>
              <button type="button" className="btn secondary small" onClick={copy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Готово' : 'Копировать'}
              </button>
            </div>
          </div>
          <p className="hint">Новый участник входит, выбирает «Присоединиться» и вводит этот код.</p>
        </div>
      )}

      <div className="field">
        <span>
          Участники · {members.length} из {household?.max_members ?? members.length}
        </span>
        <div className="list">
          {members.map((m) => (
            <div key={m.user_id} className="list-row">
              <span className="main">{m.display_name}</span>
              {m.user_id === userId && <span className="tag">это вы</span>}
            </div>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Ваше имя</span>
        <div className="inline">
          <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <button type="button" className="btn secondary small" onClick={saveName}>
            Сохранить
          </button>
        </div>
      </label>

      {archived.length > 0 && (
        <div className="field">
          <span>Скрытые</span>
          <div className="list">
            {archived.map((e) => (
              <div key={e.id} className="list-row">
                <Orb entity={e} />
                <span className="main">{e.name}</span>
                <button type="button" className="link" onClick={() => void updateEntity(e.id, { archived: false })}>
                  Вернуть
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn danger" onClick={() => void supabase.auth.signOut()}>
          <LogOut size={18} /> Выйти
        </button>
      </div>
    </Sheet>
  )
}
