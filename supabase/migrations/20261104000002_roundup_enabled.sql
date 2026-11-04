alter table public.households add column roundup_enabled boolean not null default true;
grant update (roundup_enabled) on public.households to authenticated;

-- Serialize new round-ups with changes to the household switch.
create function public.check_roundup_enabled()
returns trigger language plpgsql set search_path = '' as $$
declare enabled boolean;
begin
  if new.roundup_of is not null and (tg_op = 'INSERT' or old.roundup_of is distinct from new.roundup_of or old.household_id is distinct from new.household_id) then
    select roundup_enabled into enabled from public.households where id = new.household_id for share;
    if enabled is distinct from true then
      raise exception 'round-ups are disabled' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger transactions_roundup_enabled
before insert or update of roundup_of, household_id on public.transactions for each row execute function public.check_roundup_enabled();

do $$
begin
  if not exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'households') then
    alter publication supabase_realtime add table public.households;
  end if;
end;
$$;
