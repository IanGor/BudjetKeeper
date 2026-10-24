import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { errorText, supabase } from '../lib/supabase'
import { applyTransaction, monthStart, type Totals } from '../lib/totals'
import type { Entity, EntityKind, Household, Member, Transaction } from '../lib/types'

type Status = 'loading' | 'signedOut' | 'onboarding' | 'ready'

export interface EntityInput {
  kind: EntityKind
  name: string
  icon: string
  color: string
  plan_kopecks: number | null
}

export interface TransactionInput {
  from_id: string
  to_id: string
  amount_kopecks: number
  comment: string | null
  occurred_at: string
}

interface BudgetState {
  status: Status
  userId: string | null
  household: Household | null
  members: Member[]
  entities: Record<string, Entity>
  totals: Totals
  month: string
  /** bumped on every transaction change so open lists can reload */
  txVersion: number
  toast: string | null

  setSession(session: Session | null): Promise<void>
  loadAll(): Promise<void>
  refreshTotals(): Promise<void>
  loadMembers(): Promise<void>
  showToast(message: string): void
  clearToast(): void

  createEntity(input: EntityInput): Promise<Entity | null>
  updateEntity(id: string, patch: Partial<EntityInput & { archived: boolean }>): Promise<boolean>

  addTransaction(input: TransactionInput): Promise<boolean>
  updateTransaction(old: Transaction, patch: Partial<TransactionInput>): Promise<boolean>
  deleteTransaction(tx: Transaction): Promise<boolean>
  fetchTransactions(entityId: string): Promise<Transaction[]>

  upsertEntityLocal(entity: Entity): void
  removeEntityLocal(id: string): void
  bumpTx(): void
}

const TX_COLUMNS = 'id, household_id, from_id, to_id, amount_kopecks, comment, occurred_at, created_by, created_at'

let refreshing: Promise<void> | null = null
let refreshAgain = false

export const useBudget = create<BudgetState>((set, get) => {
  const fail = (err: unknown) => {
    get().showToast(errorText(err))
    return false
  }

  return {
    status: 'loading',
    userId: null,
    household: null,
    members: [],
    entities: {},
    totals: {},
    month: monthStart(),
    txVersion: 0,
    toast: null,

    async setSession(session) {
      if (!session) {
        set({ status: 'signedOut', userId: null, household: null, members: [], entities: {}, totals: {} })
        return
      }
      if (session.user.id === get().userId && get().status === 'ready') return
      set({ userId: session.user.id })
      await get().loadAll()
    },

    async loadAll() {
      const userId = get().userId
      if (!userId) return
      const month = monthStart()

      const { data: me, error } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) {
        fail(error)
        if (get().status === 'loading') set({ status: 'onboarding' })
        return
      }
      if (!me) {
        set({ status: 'onboarding', household: null })
        return
      }

      const hid = me.household_id as string
      const [h, members, entities, totals] = await Promise.all([
        supabase.from('households').select('id, name, invite_code').eq('id', hid).single(),
        supabase.from('household_members').select('household_id, user_id, display_name').eq('household_id', hid),
        supabase.from('entities').select('*').eq('household_id', hid).order('position'),
        supabase.rpc('entity_totals', { p_month: month }),
      ])
      const err = h.error ?? members.error ?? entities.error ?? totals.error
      if (err) {
        fail(err)
        return
      }

      set({
        status: 'ready',
        month,
        household: h.data as Household,
        members: members.data as Member[],
        entities: Object.fromEntries((entities.data as Entity[]).map((e) => [e.id, e])),
        totals: toTotals(totals.data),
        txVersion: get().txVersion + 1,
      })
    },

    async refreshTotals() {
      if (refreshing) {
        refreshAgain = true
        return refreshing
      }
      refreshing = (async () => {
        do {
          refreshAgain = false
          const { data, error } = await supabase.rpc('entity_totals', { p_month: get().month })
          if (!error) set({ totals: toTotals(data) })
        } while (refreshAgain)
      })()
      try {
        await refreshing
      } finally {
        refreshing = null
      }
    },

    async loadMembers() {
      const hid = get().household?.id
      if (!hid) return
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, user_id, display_name')
        .eq('household_id', hid)
      if (!error) set({ members: data as Member[] })
    },

    showToast(message) {
      set({ toast: message })
    },
    clearToast() {
      set({ toast: null })
    },

    async createEntity(input) {
      const { household, entities } = get()
      if (!household) return null
      const position =
        Math.max(-1, ...Object.values(entities).filter((e) => e.kind === input.kind).map((e) => e.position)) + 1
      const { data, error } = await supabase
        .from('entities')
        .insert({ ...input, household_id: household.id, position })
        .select('*')
        .single()
      if (error) {
        fail(error)
        return null
      }
      get().upsertEntityLocal(data as Entity)
      return data as Entity
    },

    async updateEntity(id, patch) {
      const prev = get().entities[id]
      if (!prev) return false
      get().upsertEntityLocal({ ...prev, ...patch })
      const { error } = await supabase.from('entities').update(patch).eq('id', id)
      if (error) {
        get().upsertEntityLocal(prev)
        return fail(error)
      }
      return true
    },

    async addTransaction(input) {
      const { household, entities, month } = get()
      if (!household) return false
      set({ totals: applyTransaction(get().totals, entities, input, month) })
      const { error } = await supabase.from('transactions').insert({ ...input, household_id: household.id })
      if (error) {
        set({ totals: applyTransaction(get().totals, get().entities, input, month, -1) })
        return fail(error)
      }
      get().bumpTx()
      void get().refreshTotals()
      return true
    },

    async updateTransaction(old, patch) {
      const { entities, month } = get()
      const next = { ...old, ...patch }
      const swap = (a: Transaction, b: Transaction) =>
        set({ totals: applyTransaction(applyTransaction(get().totals, entities, a, month, -1), entities, b, month) })
      swap(old, next)
      const { error } = await supabase.from('transactions').update(patch).eq('id', old.id)
      if (error) {
        swap(next, old)
        return fail(error)
      }
      get().bumpTx()
      void get().refreshTotals()
      return true
    },

    async deleteTransaction(tx) {
      const { entities, month } = get()
      set({ totals: applyTransaction(get().totals, entities, tx, month, -1) })
      const { error } = await supabase.from('transactions').delete().eq('id', tx.id)
      if (error) {
        set({ totals: applyTransaction(get().totals, get().entities, tx, month) })
        return fail(error)
      }
      get().bumpTx()
      void get().refreshTotals()
      return true
    },

    async fetchTransactions(entityId) {
      const { data, error } = await supabase
        .from('transactions')
        .select(TX_COLUMNS)
        .or(`from_id.eq.${entityId},to_id.eq.${entityId}`)
        .order('occurred_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) {
        fail(error)
        return []
      }
      return data as Transaction[]
    },

    upsertEntityLocal(entity) {
      set({ entities: { ...get().entities, [entity.id]: entity } })
    },
    removeEntityLocal(id) {
      const { [id]: _removed, ...rest } = get().entities
      set({ entities: rest })
    },
    bumpTx() {
      set({ txVersion: get().txVersion + 1 })
    },
  }
})

function toTotals(rows: unknown): Totals {
  return Object.fromEntries(
    ((rows ?? []) as { entity_id: string; total_kopecks: number }[]).map((r) => [r.entity_id, Number(r.total_kopecks)]),
  )
}

/** Entities of one kind, visible on the board, in display order. */
export function selectKind(entities: Record<string, Entity>, kind: EntityKind): Entity[] {
  return Object.values(entities)
    .filter((e) => e.kind === kind && !e.archived)
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
}
