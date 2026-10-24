import { Copy, LogOut } from 'lucide-react'
import { useState } from 'react'
import { errorText, supabase } from '../lib/supabase'
import { useBudget } from '../store/budget'
import { Sheet } from './Sheet'

export function Settings({ onClose }: { onClose(): void }) {
  const household = useBudget((s) => s.household)
  const members = useBudget((s) => s.members)
  const userId = useBudget((s) => s.userId)
  const entities = useBudget((s) => s.entities)
  const updateEntity = useBudget((s) => s.updateEntity)
  const loadMembers = useBudget((s) => s.loadMembers)
  const showToast = useBudget((s) => s.showToast)
  const me = members.find((m) => m.user_id === userId)
  const [name, setName] = useState(me?.display_name ?? '')
  const [copied, setCopied] = useState(false)

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

  return (
    <Sheet title={household?.name ?? 'Настройки'} onClose={onClose}>
      <div className="field">
        <span>Код приглашения</span>
        <div className="invite">{household?.invite_code}</div>
        <button type="button" className="btn secondary" onClick={copy}>
          <Copy size={16} /> {copied ? 'Скопировано' : 'Скопировать'}
        </button>
        <p className="hint">Второй участник регистрируется, выбирает «Присоединиться» и вводит этот код.</p>
      </div>

      <div className="field">
        <span>Участники</span>
        {members.map((m) => (
          <div key={m.user_id} className="member">
            <span>{m.display_name}</span>
            {m.user_id === userId && <span className="hint" style={{ margin: 0 }}>это вы</span>}
          </div>
        ))}
      </div>

      <label className="field">
        <span>Ваше имя</span>
        <div className="inline">
          <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <button type="button" className="btn secondary" style={{ flex: '0 0 auto', width: 'auto' }} onClick={saveName}>
            Сохранить
          </button>
        </div>
      </label>

      {archived.length > 0 && (
        <div className="field">
          <span>Скрытые</span>
          {archived.map((e) => (
            <div key={e.id} className="member">
              <span>{e.name}</span>
              <button type="button" className="link" onClick={() => void updateEntity(e.id, { archived: false })}>
                Вернуть
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn danger" onClick={() => void supabase.auth.signOut()}>
          <LogOut size={16} /> Выйти
        </button>
      </div>
    </Sheet>
  )
}
