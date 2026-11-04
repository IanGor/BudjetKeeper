// Isolated UI fixture; never part of the production entry point.
import { createRoot } from 'react-dom/client'
import { Board } from '../src/components/Board'
import { useBudget } from '../src/store/budget'
import { monthStart } from '../src/lib/totals'
import '../src/styles.css'
const entities = [
  ['source', 'Зарплатный счет', 'account', true, null],
  ['regular', 'Каждый день', 'account', true, null],
  ['savings', 'Накопления', 'account', false, null],
  ['food', 'Продукты', 'expense', true, 20000],
  ['travel', 'Транспорт', 'expense', true, 10000],
].map(([id, name, kind, in_balance, plan_kopecks], position) => ({ id, name, kind, in_balance, plan_kopecks, position, household_id: 'household', archived: false, icon: 'wallet', color: '#3a86f0', created_at: '2026-01-01' }))
useBudget.setState({ status: 'ready', userId: 'user', month: monthStart(), entities: Object.fromEntries(entities.map((e) => [e.id, e])), totals: { source: 100000, regular: 900000, savings: 0 }, household: { id: 'household', name: 'Семья', distribution_source_id: 'source', max_members: 2, invite_code: 'TEST', roundup_enabled: true, roundup_account_id: null, roundup_step: 1000, roundup_skip_from: [], roundup_skip_to: [] }, members: [], loadAll: async () => {} })
createRoot(document.getElementById('root')!).render(<Board />)
