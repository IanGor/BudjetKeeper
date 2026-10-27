import { ChevronLeft, X } from 'lucide-react'
import type { Entity } from '../lib/types'
import { useBudget } from '../store/budget'
import { Orb } from './Coin'
import { Sheet } from './Sheet'

export const ROUNDUP_STEPS = [5, 10, 50, 100]

/** One line for the settings list: where round-ups go and by which rule. */
export function roundupSummary(accountName: string | undefined, stepKopecks: number): string {
  return accountName ? `${accountName} · до ${stepKopecks / 100} ₽` : 'Выключено'
}

/** Entities left out of rounding: only they are listed, the select below adds one more. */
function ExceptionList({ label, hint, empty, ids, choices, onChange }: {
  label: string
  hint: string
  empty: string
  ids: string[]
  choices: Entity[]
  onChange(ids: string[]): void
}) {
  const chosen = ids.map((id) => choices.find((c) => c.id === id)).filter((c): c is Entity => c !== undefined)
  const rest = choices.filter((c) => !ids.includes(c.id))
  return (
    <section className="field">
      <span>{label}</span>
      <div className="list">
        {chosen.length === 0 && <div className="list-row muted">{empty}</div>}
        {chosen.map((c) => (
          <div key={c.id} className="list-row">
            <Orb entity={c} />
            <span className="main">{c.name}</span>
            <button type="button" className="icon-btn" aria-label={`Убрать «${c.name}»`} onClick={() => onChange(ids.filter((id) => id !== c.id))}>
              <X size={18} />
            </button>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <select className="input" value="" aria-label={`${label}: добавить`} onChange={(e) => e.target.value && onChange([...ids, e.target.value])}>
          <option value="">+ Добавить</option>
          {rest.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <p className="hint left">{hint}</p>
    </section>
  )
}

/** The «Округление» screen of the settings: a trip from the settings list and back. */
export function RoundupSettings({ onBack, onClose }: { onBack(): void; onClose(): void }) {
  const household = useBudget((s) => s.household)
  const entities = useBudget((s) => s.entities)
  const setRoundup = useBudget((s) => s.setRoundup)
  if (!household) return null

  const live = Object.values(entities).filter((e) => !e.archived)
  const accounts = live.filter((e) => e.kind === 'account')
  const categories = live.filter((e) => e.kind === 'expense')
  const on = household.roundup_account_id !== null

  return (
    <Sheet
      title="Округление"
      subtitle="Траты со счёта на категорию"
      leading={
        <button type="button" className="icon-btn back" aria-label="Назад к настройкам" onClick={onBack}>
          <ChevronLeft size={22} />
        </button>
      }
      onClose={onClose}
    >
      <label className="field">
        <span>Разница приходит на счёт</span>
        <select
          className="input"
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
      </label>

      {on && (
        <>
          <div className="field">
            <span>Округлять вверх</span>
            <div className="segmented" role="radiogroup" aria-label="Правило округления">
              {ROUNDUP_STEPS.map((rub) => (
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
          </div>

          <ExceptionList
            label="Не округлять траты со счетов"
            hint="Например, счета корректировки."
            empty="Округляются траты со всех счетов"
            ids={household.roundup_skip_from}
            choices={accounts}
            onChange={(ids) => void setRoundup({ roundup_skip_from: ids })}
          />
          <ExceptionList
            label="Не округлять траты на категории"
            hint="Траты на них записываются как есть, без округления."
            empty="Округляются траты на все категории"
            ids={household.roundup_skip_to}
            choices={categories}
            onChange={(ids) => void setRoundup({ roundup_skip_to: ids })}
          />
        </>
      )}
      <p className="hint left">Переводы между счетами и доходы не округляются никогда.</p>
    </Sheet>
  )
}
