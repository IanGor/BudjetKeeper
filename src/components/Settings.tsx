import { Check, Copy, LogOut, X } from 'lucide-react'
import { useState } from 'react'
import { errorText, supabase } from '../lib/supabase'
import { setThemePref, useThemePref, type ThemePref } from '../lib/theme'
import { useBudget } from '../store/budget'
import type { Entity } from '../lib/types'
import { Orb } from './Coin'
import { Sheet } from './Sheet'

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Авто' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

const STEPS = [5, 10, 50, 100]

/** A list of accounts left out of rounding: shows only them, «Добавить» picks one more. */
function AccountPicker({ label, hint, ids, accounts, onChange }: {
  label: string
  hint: string
  ids: string[]
  accounts: Entity[]
  onChange(ids: string[]): void
}) {
  const chosen = ids.map((id) => accounts.find((a) => a.id === id)).filter((a): a is Entity => a !== undefined)
  const rest = accounts.filter((a) => !ids.includes(a.id))
  return (
    <div className="field">
      <span>{label}</span>
      {chosen.length > 0 && (
        <div className="list">
          {chosen.map((a) => (
            <div key={a.id} className="list-row">
              <Orb entity={a} />
              <span className="main">{a.name}</span>
              <button type="button" className="link" aria-label={`Убрать «${a.name}»`} onClick={() => onChange(ids.filter((id) => id !== a.id))}>
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <select
          className="input"
          value=""
          aria-label={`${label}: добавить счёт`}
          onChange={(e) => e.target.value && onChange([...ids, e.target.value])}
        >
          <option value="">+ Добавить счёт</option>
          {rest.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}
      <p className="hint">{hint}</p>
    </div>
  )
}

export function Settings({ onClose }: { onClose(): void }) {
  const household = useBudget((s) => s.household)
  const members = useBudget((s) => s.members)
  const userId = useBudget((s) => s.userId)
  const entities = useBudget((s) => s.entities)
  const updateEntity = useBudget((s) => s.updateEntity)
  const setRoundup = useBudget((s) => s.setRoundup)
  const loadMembers = useBudget((s) => s.loadMembers)
  const showToast = useBudget((s) => s.showToast)
  const theme = useThemePref()
  const me = members.find((m) => m.user_id === userId)
  const [name, setName] = useState(me?.display_name ?? '')
  const [copied, setCopied] = useState(false)

  // the code is useless once the budget is full; it reappears when max_members is raised
  const full = !household || members.length >= household.max_members
  const archived = Object.values(entities).filter((e) => e.archived)
  const accounts = Object.values(entities).filter((e) => e.kind === 'account' && !e.archived)

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
          <span>Округление</span>
          <p className="hint" style={{ textAlign: 'left', marginTop: 0 }}>
            Траты со счетов на категории округляются вверх, разница приходит на выбранный счёт.
          </p>
          <select
            className="input"
            aria-label="Счёт для округлений"
            value={household.roundup_account_id ?? ''}
            onChange={(e) => void setRoundup({ roundup_account_id: e.target.value || null })}
          >
            <option value="">Не округлять</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {household.roundup_account_id && (
            <>
              <div className="segmented" role="radiogroup" aria-label="Правило округления" style={{ marginTop: 10 }}>
                {STEPS.map((rub) => (
                  <button
                    key={rub}
                    type="button"
                    role="radio"
                    aria-checked={household.roundup_step === rub * 100}
                    className={household.roundup_step === rub * 100 ? 'on' : ''}
                    onClick={() => void setRoundup({ roundup_step: rub * 100 })}
                  >
                    до {rub} ₽
                  </button>
                ))}
              </div>
              <AccountPicker
                label="Не округлять траты со счетов"
                hint="С этих счетов округление не берётся — например, со счетов корректировки."
                ids={household.roundup_skip_from}
                accounts={accounts}
                onChange={(ids) => void setRoundup({ roundup_skip_from: ids })}
              />
            </>
          )}
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
