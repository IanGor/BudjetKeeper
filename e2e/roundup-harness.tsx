import { createRoot } from 'react-dom/client'
import { RoundupSettings } from '../src/components/RoundupSettings'
import { useBudget } from '../src/store/budget'
import '../src/styles.css'

const savings = { id: 'savings', household_id: 'household', name: 'Накопления', kind: 'account' as const, in_balance: false, plan_kopecks: null, position: 0, archived: false, icon: 'wallet', color: '#3a86f0', created_at: '2026-01-01' }
useBudget.setState({ household: { id: 'household', name: 'Семья', distribution_source_id: null, max_members: 2, invite_code: 'TEST', roundup_enabled: true, roundup_account_id: 'savings', roundup_step: 1000, roundup_skip_from: [], roundup_skip_to: [] }, entities: { savings } })
createRoot(document.getElementById('root')!).render(<RoundupSettings onBack={() => {}} onClose={() => {}} />)
