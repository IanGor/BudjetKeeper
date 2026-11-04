import { useEffect, useMemo, useRef, useState } from 'react'
import { useOnline } from '../hooks/useOnline'
import { budgetEvent, distributionSummary, monthLabel, nextMonth, withMonthlyLimits } from '../lib/monthlyBudget'
import { formatRub, parseRub } from '../lib/money'
import { todayISO } from '../lib/totals'
import { selectKind, useBudget } from '../store/budget'
import { Orb } from './Coin'
import { Sheet } from './Sheet'

interface PendingDistribution { id: string; source: string; allocations: Record<string, number>; date: string }
function readPending(key: string): PendingDistribution | null {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null }
}

export function MonthlyBudget({ onClose }: { onClose(): void }) {
  const household = useBudget((s) => s.household)!
  const entities = useBudget((s) => s.entities)
  const totals = useBudget((s) => s.totals)
  const monthly = useBudget((s) => s.monthlyBudget)
  const month = useBudget((s) => s.month)
  const online = useOnline()
  const accounts = selectKind(entities, 'account')
  const expenses = useMemo(() => selectKind(withMonthlyLimits(entities, monthly.current_limits), 'expense'), [entities, monthly.current_limits])
  const target = nextMonth(month)
  const pendingKey = `bk.distribution.${household.id}`
  const [pending, setPending] = useState(() => readPending(pendingKey))
  const [source, setSource] = useState(pending?.source ?? (accounts.some((a) => a.id === household.distribution_source_id) ? household.distribution_source_id! : accounts[0]?.id ?? ''))
  const [amounts, setAmounts] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(pending?.allocations ?? {}).map(([id, amount]) => [id, String(amount / 100)])))
  const [step, setStep] = useState<'start' | 'distribute' | 'offer' | 'limits'>(pending ? 'distribute' : 'start')
  const [limits, setLimits] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [error, setError] = useState('')
  const [confirmedMonth, setConfirmedMonth] = useState(target)
  const recipients = accounts.filter((a) => a.id !== source)
  const allocations = Object.fromEntries(recipients.map((a) => [a.id, amounts[a.id]?.trim() ? parseRub(amounts[a.id]) : 0]))
  const invalid = Object.values(allocations).some((v) => v === null)
  const { remainder } = distributionSummary(entities[source], totals[source] ?? 0, allocations as Record<string, number>, entities)
  const available = monthly.distribution?.available_kopecks
  const limitAmounts = Object.fromEntries(expenses.map((e) => [e.id, limits[e.id]?.trim() ? parseRub(limits[e.id]) : 0]))
  const invalidLimits = Object.values(limitAmounts).some((v) => v === null)
  const planned = Object.values(limitAmounts).reduce<number>((sum, v) => sum + (v ?? 0), 0)
  const difference = (available ?? 0) - planned

  useEffect(() => {
    // Rollover changes the meaning of "next month"; never save the old form under a new date.
    setStep(readPending(pendingKey) ? 'distribute' : 'start')
    setError('')
  }, [month, pendingKey])

  const openLimits = () => {
    setLimits(Object.fromEntries(expenses.map((e) => [e.id, String(((Object.hasOwn(monthly.next_limits, e.id) ? monthly.next_limits[e.id] : e.plan_kopecks) ?? 0) / 100)])))
    setError('')
    setStep('limits')
  }
  const start = () => {
    budgetEvent('distribution_started', { month: target })
    setStep('distribute')
  }
  const confirm = async () => {
    if (saving.current || !online || (!pending && (invalid || remainder < 0 || !source))) return
    saving.current = true
    setBusy(true)
    setError('')
    const request = pending ?? { id: crypto.randomUUID(), source, allocations: allocations as Record<string, number>, date: todayISO() }
    try {
      // Persist before sending: closing the app after a lost response must not duplicate transfers.
      localStorage.setItem(pendingKey, JSON.stringify(request))
      setPending(request)
      const result = await useBudget.getState().distribute(request.id, request.source, request.allocations, request.date)
      if (result && 'id' in result) {
        localStorage.removeItem(pendingKey)
        setPending(null)
        setConfirmedMonth(result.month)
        budgetEvent('distribution_confirmed', { month: result.month })
        setStep('offer')
      } else if (result?.rejected) {
        localStorage.removeItem(pendingKey)
        setPending(null)
        setError('Распределение отклонено. Проверьте остаток и суммы, затем повторите.')
      } else setError('Не удалось подтвердить результат. Повторите запрос: сохраненные переводы не будут созданы дважды.')
    } catch {
      setError('Не удалось сохранить или подтвердить запрос. Проверьте связь и доступ к хранилищу, затем повторите.')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  const saveLimits = async () => {
    if (saving.current || invalidLimits || !online) return
    saving.current = true
    setBusy(true)
    setError('')
    try {
      if (await useBudget.getState().saveMonthlyPlan(target, limitAmounts as Record<string, number>)) {
        budgetEvent('monthly_plan_saved', { month: target, over: available !== undefined && difference < 0, edited: Boolean(monthly.saved_at) })
        onClose()
      } else setError('План не сохранен. Проверьте связь и повторите попытку.')
    } catch { setError('План не сохранен. Повторите попытку.') }
    finally { saving.current = false; setBusy(false) }
  }

  return <Sheet className="monthly-budget" title={step === 'limits' ? 'Лимиты следующего месяца' : step === 'distribute' ? 'Распределение денег' : 'Планирование бюджета'} subtitle={monthLabel(step === 'offer' ? confirmedMonth : target)} dismissDisabled={busy} onClose={onClose}>
    {step === 'start' && <>
      <p className="hint left">Распределите деньги со счета, затем подготовьте лимиты следующего месяца.</p>
      <div className="btn-row"><button className="btn" onClick={start} disabled={!online || accounts.length === 0}>Распределить деньги</button></div>
      {accounts.length === 0 && <p className="empty">Добавьте счет, чтобы распределять деньги.</p>}
      {monthly.distribution && <>
        <p className="hint left">Доступно для планирования: {formatRub(available!)}. Сумма сохранена при последнем распределении и не меняется после трат.</p>
        <div className="btn-row"><button className="btn secondary" onClick={openLimits}>{monthly.saved_at ? 'Редактировать лимиты' : 'Продолжить к лимитам'}</button></div>
      </>}
      {!monthly.distribution && monthly.saved_at && <div className="btn-row"><button className="btn secondary" onClick={openLimits}>Редактировать лимиты</button></div>}
    </>}
    {step === 'distribute' && <>
      <fieldset disabled={busy || Boolean(pending)} className="budget-fields">
        <label className="field"><span>Счет-источник</span><select className="input" value={source} onChange={(e) => { setSource(e.target.value); setAmounts({}) }}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select></label>
        <p className="hint left">На счете: {formatRub(totals[source] ?? 0)}</p>
        <div className="budget-rows">{recipients.map((a) => <div className="budget-row" key={a.id}>
          <label className="budget-amount"><span><Orb entity={a} /><span>{a.name}{a.in_balance === false && <small>Не входит в общий баланс</small>}</span></span>
            <input className="input num" inputMode="decimal" aria-label={`Перевод на ${a.name}`} value={amounts[a.id] ?? ''} placeholder="0" onChange={(e) => setAmounts({ ...amounts, [a.id]: e.target.value })} aria-invalid={Boolean(amounts[a.id]?.trim()) && parseRub(amounts[a.id]) === null} />
          </label>
          <button className="link budget-remainder" disabled={invalid || remainder < 0} onClick={() => setAmounts({ ...amounts, [a.id]: String(((allocations[a.id] ?? 0) + remainder) / 100) })}>Перевести остаток</button>
        </div>)}</div>
      </fieldset>
      <div className="budget-summary" aria-live="polite"><span>Нераспределенный остаток</span><strong className={remainder < 0 ? 'error' : 'num'}>{formatRub(remainder)}</strong></div>
      {invalid && <p className="error">Введите суммы в рублях, до двух знаков после запятой.</p>}
      {!invalid && remainder < 0 && <p className="error">Сумма переводов больше остатка источника.</p>}
      {pending && <p className="hint left">Запрос сохранен. Подтвердите его результат перед новым распределением.</p>}
      <div className="btn-row"><button className="btn" disabled={!online || busy || (!pending && (invalid || remainder < 0 || !source))} onClick={() => void confirm()}>{busy ? 'Подтверждение...' : pending ? 'Повторить подтверждение' : 'Подтвердить распределение'}</button></div>
    </>}
    {step === 'offer' && <>
      <p>Распределение завершено. Переводы сохранены в истории.</p>
      {confirmedMonth === target && <div className="btn-row"><button className="btn" onClick={openLimits}>Перейти к лимитам</button></div>}
      <div className="btn-row"><button className="btn secondary" onClick={onClose}>Закончить позже</button></div>
    </>}
    {step === 'limits' && <>
      <p className="hint left">Эти лимиты начнут действовать с первого числа. Текущие лимиты сохраняются до конца месяца.</p>
      {available === undefined ? <p className="hint left">Расчетная сумма недоступна. Распределите деньги, чтобы сравнить лимиты с ней.</p> : <div className="budget-summary"><span>Доступно для планирования</span><strong className="num">{formatRub(available)}</strong></div>}
      <fieldset disabled={busy} className="budget-fields"><div className="budget-rows">{expenses.map((e) => <div className="budget-row" key={e.id}>
        <label className="budget-amount"><span><Orb entity={e} /><span>{e.name}</span></span><input className="input num" inputMode="decimal" aria-label={`Лимит ${e.name}`} value={limits[e.id] ?? ''} onChange={(event) => setLimits({ ...limits, [e.id]: event.target.value })} aria-invalid={Boolean(limits[e.id]?.trim()) && parseRub(limits[e.id]) === null} /></label>
      </div>)}</div></fieldset>
      {expenses.length === 0 && <p className="empty">Категорий расходов пока нет.</p>}
      <div className="budget-summary" aria-live="polite"><span>Сумма лимитов</span><strong className="num">{formatRub(planned)}</strong></div>
      {available !== undefined && <div className="budget-summary" aria-live="polite"><span>{difference < 0 ? 'Превышение доступной суммы' : 'Осталось сверх лимитов'}</span><strong className={difference < 0 ? 'error' : 'num'}>{formatRub(Math.abs(difference))}</strong></div>}
      {available !== undefined && difference < 0 && <p className="hint left">Можно сохранить: превышение может покрываться накоплениями.</p>}
      {invalidLimits && <p className="error">Проверьте суммы лимитов. Допустимы рубли и копейки.</p>}
      <div className="btn-row"><button className="btn" onClick={() => void saveLimits()} disabled={busy || !online || invalidLimits}>{busy ? 'Сохранение...' : 'Сохранить лимиты'}</button></div>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
  </Sheet>
}
