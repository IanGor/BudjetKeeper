// Seeds the local Supabase stack with a budget shaped like the real one
// (same coins, long names, plans, large and negative amounts) for the UI tests.
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'

export const USER = { email: 'e2e-igor@test.local', password: 'password123' }

type Kind = 'income' | 'account' | 'expense'
type Row = [kind: Kind, name: string, icon: string, color: string, plan?: number]

const ENTITIES: Row[] = [
  ['income', 'ЗП Игорь', 'landmark', '#4cb860'],
  ['income', 'Аванс Игорь', 'landmark', '#4cb860'],
  ['income', 'Отпускные Игорь', 'landmark', '#4cb860'],
  ['income', 'Другое Игорь', 'landmark', '#4cb860'],
  ['income', 'Ира', 'landmark', '#f08c3a'],
  ['income', 'Авито', 'hand-coins', '#f08c3a'],
  ['account', 'Этот месяц', 'credit-card', '#3a86f0'],
  ['account', 'Бэйбик', 'credit-card', '#3a86f0'],
  ['account', 'Красота и одежда', 'credit-card', '#3a86f0'],
  ['account', 'Здоровье', 'credit-card', '#3a86f0'],
  ['account', 'На следующий месяц', 'credit-card', '#3a86f0'],
  ['account', 'Ремонт', 'credit-card', '#3a86f0'],
  ['account', 'Подписки', 'credit-card', '#3a86f0'],
  ['account', 'ЖКХ', 'credit-card', '#3a86f0'],
  ['account', 'Путешествия', 'credit-card', '#3a86f0'],
  ['account', 'Стоматолог', 'credit-card', '#3a86f0'],
  ['account', 'Вклад', 'credit-card', '#3a86f0'],
  ['account', 'Подушка', 'credit-card', '#3a86f0'],
  ['expense', 'Продукты', 'shopping-cart', '#4cb860', 7000000],
  ['expense', 'Транспорт', 'bus', '#3a86f0', 1500000],
  ['expense', 'Еда в городе', 'coffee', '#f08c3a', 2500000],
  ['expense', 'Развлечения', 'gamepad-2', '#9a73d9', 3000000],
  ['expense', 'ЖКХ', 'landmark', '#f08c3a', 2000000],
  ['expense', 'Аренда', 'landmark', '#f08c3a', 8000000],
  ['expense', 'Бэйбик', 'bike', '#f08c3a', 3000000],
  ['expense', 'Красота одежда', 'shirt', '#f08c3a', 610000],
  ['expense', 'Маме', 'hand-coins', '#f08c3a', 3000000],
  ['expense', 'Подписки', 'trending-up', '#f08c3a', 5317000],
]

// [from, to, kopecks]: income → account, account → expense
const FLOWS: [string, string, number][] = [
  ['income:ЗП Игорь', 'account:Этот месяц', 123456700],
  ['income:Аванс Игорь', 'account:На следующий месяц', 9500000],
  ['income:Ира', 'account:Подушка', 15000000],
  ['account:Этот месяц', 'expense:Продукты', 4523000],
  ['account:Этот месяц', 'expense:Аренда', 8000000],
  ['account:Этот месяц', 'expense:Еда в городе', 2750000],
  ['account:Этот месяц', 'expense:Красота одежда', 1234500],
  ['account:Ремонт', 'expense:ЖКХ', 1830000],
]

export async function seed() {
  const env = loadEnv('test', process.cwd(), '')
  const url = env.VITE_SUPABASE_URL
  if (!url?.startsWith('http://127.0.0.1')) throw new Error('UI tests run only against the local Supabase stack')
  const opts = { auth: { persistSession: false, autoRefreshToken: false } }
  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, opts)

  // fresh user and household on every run
  const { data: list } = await admin.auth.admin.listUsers()
  const old = list.users.find((u) => u.email === USER.email)
  if (old) {
    const { data: m } = await admin.from('household_members').select('household_id').eq('user_id', old.id).maybeSingle()
    if (m) {
      await admin.from('transactions').delete().eq('household_id', m.household_id)
      await admin.from('households').delete().eq('id', m.household_id)
    }
    await admin.auth.admin.deleteUser(old.id)
  }
  const created = await admin.auth.admin.createUser({ ...USER, email_confirm: true })
  if (created.error) throw created.error

  const user = createClient(url, env.VITE_SUPABASE_ANON_KEY, opts)
  const signIn = await user.auth.signInWithPassword(USER)
  if (signIn.error) throw signIn.error
  const hh = await user.rpc('create_household', { p_name: 'Семейный', p_display_name: 'Игорь' })
  if (hh.error) throw hh.error
  const hid = hh.data as string

  await admin.from('entities').delete().eq('household_id', hid)
  const pos: Record<string, number> = {}
  const rows = ENTITIES.map(([kind, name, icon, color, plan]) => ({
    household_id: hid, kind, name, icon, color, plan_kopecks: plan ?? null, position: (pos[kind] = (pos[kind] ?? -1) + 1),
  }))
  const ins = await admin.from('entities').insert(rows).select('id, kind, name')
  if (ins.error) throw ins.error
  const id = Object.fromEntries(ins.data.map((e) => [`${e.kind}:${e.name}`, e.id as string]))

  const tx = FLOWS.map(([f, t, k]) => ({ household_id: hid, from_id: id[f], to_id: id[t], amount_kopecks: k }))
  // a negative balance: money leaves an account that never received any
  tx.push({ household_id: hid, from_id: id['account:Стоматолог'], to_id: id['expense:Маме'], amount_kopecks: 1250000 })
  const txIns = await user.from('transactions').insert(tx)
  if (txIns.error) throw txIns.error
}
