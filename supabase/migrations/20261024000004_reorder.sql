-- Reorder coins in one round trip: position = index in p_ids.
-- Runs as the caller, so RLS limits it to the caller's household.
create function public.reorder_entities(p_ids uuid[])
returns void
language sql
set search_path = ''
as $$
  update public.entities e
  set position = o.ord - 1
  from unnest(p_ids) with ordinality as o(id, ord)
  where e.id = o.id;
$$;

revoke execute on function public.reorder_entities(uuid[]) from public, anon;
grant execute on function public.reorder_entities(uuid[]) to authenticated;
