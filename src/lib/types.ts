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
  /** the spending this round-up came from; it is deleted together with it */
  roundup_of: string | null
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
  /** rounding step, kopecks */
  roundup_step: number
  /** accounts whose outgoing operations are not rounded */
  roundup_skip_from: string[]
}

export type RoundupSettings = Pick<Household, 'roundup_account_id' | 'roundup_step' | 'roundup_skip_from'>

export interface Member {
  household_id: string
  user_id: string
  display_name: string
}
