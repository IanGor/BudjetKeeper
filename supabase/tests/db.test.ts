// Integration tests against the local Supabase stack (`npx supabase start`).
// Skipped when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set (.env.local).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const client = () => createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } })

async function signUp(name: string): Promise<SupabaseClient> {
  const c = client()
  const email = `${name}-${crypto.randomUUID().slice(0, 8)}@test.local`
  const { error } = await c.auth.signUp({ email, password: 'password123' })
  if (error) throw error
  return c
}

type Ids = Record<string, string>

async function entityIds(c: SupabaseClient): Promise<Ids> {
  const { data, error } = await c.from('entities').select('id, name')
  if (error) throw error
  return Object.fromEntries(data.map((e) => [e.name, e.id]))
}

async function totals(c: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await c.rpc('entity_totals', { p_month: new Date().toISOString().slice(0, 10) })
  if (error) throw error
  return Object.fromEntries((data as { entity_id: string; total_kopecks: number }[]).map((r) => [r.entity_id, Number(r.total_kopecks)]))
}

describe.skipIf(!url || !key)('database', () => {
  let alice: SupabaseClient
  let bob: SupabaseClient
  let eve: SupabaseClient
  let hid: string
  let ids: Ids

  beforeAll(async () => {
    ;[alice, bob, eve] = await Promise.all([signUp('alice'), signUp('bob'), signUp('eve')])

    const created = await alice.rpc('create_household', { p_name: 'Семья', p_display_name: 'Алиса' })
    expect(created.error).toBeNull()
    hid = created.data as string

    const { data: h } = await alice.from('households').select('invite_code').eq('id', hid).single()
    const joined = await bob.rpc('join_household', { p_invite_code: ` ${h!.invite_code.toLowerCase()} `, p_display_name: 'Боб' })
    expect(joined.error).toBeNull()
    expect(joined.data).toBe(hid)

    expect((await eve.rpc('create_household', { p_name: 'Чужой', p_display_name: 'Ева' })).error).toBeNull()
    ids = await entityIds(alice)
  })

  const tx = (from: string, to: string, kopecks: number, extra: object = {}) => ({
    household_id: hid,
    from_id: ids[from],
    to_id: ids[to],
    amount_kopecks: kopecks,
    ...extra,
  })

  it('creates the default set of entities', () => {
    expect(Object.keys(ids)).toHaveLength(11)
    expect(ids['Зарплата'] && ids['Карта'] && ids['Продукты']).toBeTruthy()
  })

  it('records income, expense and transfer and computes totals for both members', async () => {
    for (const row of [tx('Зарплата', 'Карта', 100000), tx('Карта', 'Продукты', 30000), tx('Карта', 'Наличные', 10000)]) {
      const { error } = await alice.from('transactions').insert(row)
      expect(error).toBeNull()
    }
    const expected = { Зарплата: 100000, Карта: 60000, Наличные: 10000, Продукты: 30000, Кафе: 0 }
    for (const c of [alice, bob]) {
      const t = await totals(c)
      for (const [name, value] of Object.entries(expected)) expect(t[ids[name]]).toBe(value)
    }
  })

  it('counts income/expense only for the requested month, account balance for all time', async () => {
    const { error } = await bob.from('transactions').insert(tx('Карта', 'Кафе', 5000, { occurred_at: '2020-01-15' }))
    expect(error).toBeNull()
    const t = await totals(bob)
    expect(t[ids['Кафе']]).toBe(0)
    expect(t[ids['Карта']]).toBe(55000)
  })

  it('rejects disallowed flows and bad amounts', async () => {
    const bad = [tx('Продукты', 'Карта', 100), tx('Зарплата', 'Продукты', 100), tx('Карта', 'Зарплата', 100), tx('Карта', 'Карта', 100), tx('Карта', 'Кафе', 0), tx('Карта', 'Кафе', -5)]
    for (const row of bad) {
      const { error } = await alice.from('transactions').insert(row)
      expect(error, JSON.stringify(row)).not.toBeNull()
    }
  })

  it('adjusts an account balance with a one-sided transaction', async () => {
    const before = (await totals(alice))[ids['Наличные']]
    const up = await alice.from('transactions').insert({ household_id: hid, from_id: null, to_id: ids['Наличные'], amount_kopecks: 1500 })
    expect(up.error).toBeNull()
    const down = await bob.from('transactions').insert({ household_id: hid, from_id: ids['Наличные'], to_id: null, amount_kopecks: 500 })
    expect(down.error).toBeNull()
    const t = await totals(alice)
    expect(t[ids['Наличные']]).toBe(before + 1000)
    expect(t[ids['Продукты']]).toBe(30000)

    const bad: { household_id: string; from_id: string | null; to_id: string | null; amount_kopecks: number }[] = [
      { household_id: hid, from_id: null, to_id: ids['Продукты'], amount_kopecks: 100 },
      { household_id: hid, from_id: ids['Зарплата'], to_id: null, amount_kopecks: 100 },
      { household_id: hid, from_id: null, to_id: null, amount_kopecks: 100 },
    ]
    for (const row of bad) {
      const { error } = await alice.from('transactions').insert(row)
      expect(error, JSON.stringify(row)).not.toBeNull()
    }
  })

  it('does not allow changing an entity kind', async () => {
    const { error } = await alice.from('entities').update({ kind: 'account' }).eq('id', ids['Продукты'])
    expect(error?.message).toMatch(/cannot be changed/)
  })

  it('isolates households from each other', async () => {
    const { data: seen } = await eve.from('entities').select('id').eq('household_id', hid)
    expect(seen).toEqual([])
    const { data: seenTx } = await eve.from('transactions').select('id').eq('household_id', hid)
    expect(seenTx).toEqual([])

    const intoForeign = await eve.from('transactions').insert(tx('Зарплата', 'Карта', 100))
    expect(intoForeign.error).not.toBeNull()

    const eveIds = await entityIds(eve)
    const { data: eveHh } = await eve.from('household_members').select('household_id').single()
    const mixed = await eve.from('transactions').insert({ household_id: eveHh!.household_id, from_id: eveIds['Карта'], to_id: ids['Продукты'], amount_kopecks: 100 })
    expect(mixed.error?.message).toMatch(/does not belong|violates/)

    const eveTotals = await totals(eve)
    expect(Object.keys(eveTotals).sort()).toEqual(Object.values(eveIds).sort())

    const upd = await eve.from('entities').update({ name: 'hacked' }).eq('id', ids['Карта']).select()
    expect(upd.data ?? []).toEqual([])
  })

  it('does not allow spoofing the author', async () => {
    const { data: bobUser } = await bob.auth.getUser()
    const { error } = await alice.from('transactions').insert(tx('Карта', 'Кафе', 100, { created_by: bobUser.user!.id }))
    expect(error).not.toBeNull()
  })

  it('allows only one household per user and validates invite codes', async () => {
    expect((await bob.rpc('create_household', { p_name: 'x', p_display_name: 'y' })).error?.message).toMatch(/already a member/)
    const stranger = await signUp('stranger')
    expect((await stranger.rpc('join_household', { p_invite_code: 'NOPE', p_display_name: 'z' })).error?.message).toMatch(/not found/)
  })

  it('denies anonymous access', async () => {
    const anon = client()
    const { data } = await anon.from('entities').select('id')
    expect(data ?? []).toEqual([])
    expect((await anon.rpc('entity_totals', { p_month: '2026-01-01' })).error).not.toBeNull()
  })

  it('delivers realtime changes to the other member', async () => {
    const { data: session } = await bob.auth.getSession()
    bob.realtime.setAuth(session.session!.access_token)

    const received = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no realtime event within 10s')), 10000)
      const channel = bob
        .channel(`household:${hid}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `household_id=eq.${hid}` }, (p) => {
          clearTimeout(timer)
          void bob.removeChannel(channel)
          resolve(p.new)
        })
        // changes are captured only after this message, which follows SUBSCRIBED
        .on('system', {}, async (m: { extension?: string; status?: string }) => {
          if (m.extension === 'postgres_changes' && m.status === 'ok') {
            const { error } = await alice.from('transactions').insert(tx('Карта', 'Кафе', 777, { comment: 'realtime' }))
            if (error) reject(error)
          }
        })
        .subscribe()
    })
    const row = await received
    expect(row.amount_kopecks).toBe(777)
    expect(row.comment).toBe('realtime')
  })
})
