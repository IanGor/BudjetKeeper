export type EntityKind = 'income' | 'account' | 'expense'

export interface Entity {
  id: string
  household_id: string
  kind: EntityKind
  name: string
  icon: string
  color: string
  plan_kopecks: number | null
  /** accounts only: counted in the total balance (savings can stay out) */
  in_balance: boolean
  position: number
  archived: boolean
  created_at: string
}

export interface Transaction {
  id: string
  household_id: string
  from_id: string | null
  to_id: string | null
  amount_kopecks: number
  comment: string | null
  occurred_at: string // YYYY-MM-DD
  created_by: string | null
  created_at: string
}

export interface Household {
  id: string
  name: string
  invite_code: string
  max_members: number
  /** account that collects round-ups of spending; null = no round-ups */
  roundup_account_id: string | null
}

export interface Member {
  household_id: string
  user_id: string
  display_name: string
}
