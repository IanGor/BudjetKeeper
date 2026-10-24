import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Entity } from '../lib/types'
import { useBudget } from '../store/budget'

/**
 * Live sync with the partner's device. Entity rows are patched in place;
 * any transaction change just re-fetches totals (tiny data set, always correct).
 * A full reload runs when the app returns to the foreground or reconnects,
 * because iOS suspends background PWAs and drops socket events meanwhile.
 */
export function useRealtime() {
  const hid = useBudget((s) => s.household?.id)

  useEffect(() => {
    if (!hid) return
    const store = useBudget.getState
    const filter = `household_id=eq.${hid}`
    const onTx = () => {
      store().bumpTx()
      void store().refreshTotals()
    }
    let dropped = false

    const channel = supabase
      .channel(`household:${hid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'entities', filter }, (p) =>
        store().upsertEntityLocal(p.new as Entity),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'entities', filter }, (p) =>
        store().upsertEntityLocal(p.new as Entity),
      )
      // DELETE events cannot be filtered server-side; unknown ids are ignored
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'entities' }, (p) =>
        store().removeEntityLocal((p.old as { id: string }).id),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter }, onTx)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transactions', filter }, onTx)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transactions' }, onTx)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter }, () =>
        void store().loadMembers(),
      )
      // changes are captured only from this point (it arrives after SUBSCRIBED):
      // re-fetch to cover the gap since the initial load
      .on('system', {}, (m: { extension?: string; status?: string }) => {
        if (m.extension === 'postgres_changes' && m.status === 'ok') onTx()
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && dropped) {
          dropped = false
          void store().loadAll()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          dropped = true
        }
      })

    const resync = () => {
      if (document.visibilityState === 'visible') void store().loadAll()
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)

    return () => {
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
      void supabase.removeChannel(channel)
    }
  }, [hid])
}
