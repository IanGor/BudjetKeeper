-- Month-specific limits preserve existing entity plans as the fallback.
alter table public.households add column distribution_source_id uuid references public.entities(id) on delete set null;

grant update (distribution_source_id) on public.households to authenticated;

create table public.monthly_limits (
  household_id uuid not null references public.households(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  entity_id uuid not null references public.entities(id) on delete cascade,
  amount_kopecks bigint check (amount_kopecks between 0 and 9999999900),
  primary key (household_id, month, entity_id)
);
create table public.monthly_plans (
  household_id uuid not null references public.households(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  saved_at timestamptz not null default now(),
  primary key (household_id, month)
);
create table public.budget_distributions (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  month date not null,
  source_id uuid not null references public.entities(id),
  allocations jsonb not null,
  available_kopecks bigint not null,
  created_at timestamptz not null default now()
);
alter table public.monthly_limits enable row level security;
alter table public.monthly_plans enable row level security;
alter table public.budget_distributions enable row level security;
create policy monthly_limits_read on public.monthly_limits for select to authenticated using (public.is_member(household_id));
create policy monthly_plans_read on public.monthly_plans for select to authenticated using (public.is_member(household_id));
create policy distributions_read on public.budget_distributions for select to authenticated using (public.is_member(household_id));
revoke all on public.monthly_limits, public.monthly_plans, public.budget_distributions from anon;

-- All account mutations use the same row locks, including ordinary spending and deletion.
create function public.lock_transaction_accounts() returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    perform id from public.entities where kind = 'account' and id in (new.from_id, new.to_id) order by id for update;
  elsif TG_OP = 'DELETE' then
    perform id from public.entities where kind = 'account' and id in (old.from_id, old.to_id) order by id for update;
  else
    perform id from public.entities where kind = 'account' and id in (old.from_id, old.to_id, new.from_id, new.to_id) order by id for update;
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger accounts_lock before insert or update or delete on public.transactions
for each row execute function public.lock_transaction_accounts();

create function public.check_distribution_source() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.distribution_source_id is not null and not exists (
    select 1 from public.entities where id = new.distribution_source_id and household_id = new.id and kind = 'account' and not archived
  ) then raise exception 'invalid distribution source' using errcode = '22023'; end if;
  return new;
end;
$$;
create trigger households_distribution_source before insert or update of distribution_source_id on public.households
for each row execute function public.check_distribution_source();

create function public.monthly_budget_state(p_month date) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'current_limits', coalesce((select jsonb_object_agg(e.id, (
      select l.amount_kopecks from public.monthly_limits l where l.entity_id = e.id and l.month <= p_month order by l.month desc limit 1
    )) from public.entities e where e.kind = 'expense' and exists (
      select 1 from public.monthly_limits l where l.entity_id = e.id and l.month <= p_month
    )), '{}'::jsonb),
    'next_limits', coalesce((select jsonb_object_agg(entity_id, amount_kopecks) from public.monthly_limits where month = (p_month + interval '1 month')::date), '{}'::jsonb),
    'saved_at', (select saved_at from public.monthly_plans where month = (p_month + interval '1 month')::date),
    'distribution', (select to_jsonb(d) from public.budget_distributions d where month = (p_month + interval '1 month')::date order by created_at desc, id desc limit 1)
  );
$$;

create function public.save_category_limit(p_entity uuid, p_month date, p_amount bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  select household_id into hid from public.entities where id = p_entity and kind = 'expense';
  if hid is null or not public.is_member(hid) then raise exception 'not authorized' using errcode = '42501'; end if;
  insert into public.monthly_limits values (hid, p_month, p_entity, p_amount)
  on conflict (household_id, month, entity_id) do update set amount_kopecks = excluded.amount_kopecks;
end;
$$;

create function public.distribute_budget(p_id uuid, p_source uuid, p_allocations jsonb, p_date date) returns public.budget_distributions
language plpgsql security definer set search_path = '' as $$
declare
  hid uuid;
  src public.entities;
  prior public.budget_distributions;
  result public.budget_distributions;
  balance bigint;
  allocated bigint := 0;
  available bigint := 0;
  item record;
begin
  select household_id into hid from public.entities where id = p_source;
  if hid is null or not public.is_member(hid) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_id is null or p_date is null or jsonb_typeof(p_allocations) is distinct from 'object' then
    raise exception 'invalid distribution' using errcode = '22023';
  end if;
  -- Serialize retries and simultaneous distributions in this household.
  perform id from public.households where id = hid for update;
  select * into prior from public.budget_distributions where id = p_id;
  if found then
    if prior.household_id <> hid or prior.source_id <> p_source or prior.allocations <> p_allocations then
      raise exception 'distribution request changed' using errcode = '22023';
    end if;
    return prior;
  end if;
  if abs(p_date - current_date) > 1 then raise exception 'invalid distribution date' using errcode = '22023'; end if;
  perform id from public.entities where household_id = hid and kind = 'account' order by id for update;
  select * into src from public.entities where id = p_source;
  if src.kind <> 'account' or src.archived then raise exception 'invalid distribution source' using errcode = '22023'; end if;
  select coalesce(sum(case when to_id = p_source then amount_kopecks else -amount_kopecks end), 0)
    into balance from public.transactions where from_id = p_source or to_id = p_source;
  for item in select key, value from jsonb_each_text(p_allocations) loop
    if item.value is null or item.value !~ '^\d+$' or item.value::numeric > 9999999900 then
      raise exception 'invalid allocation amount' using errcode = '22023';
    end if;
    if not exists (select 1 from public.entities where id = item.key::uuid and household_id = hid and kind = 'account' and not archived and id <> p_source) then
      raise exception 'invalid allocation account' using errcode = '22023';
    end if;
    allocated := allocated + item.value::bigint;
    if exists (select 1 from public.entities where id = item.key::uuid and in_balance) then
      available := available + item.value::bigint;
    end if;
  end loop;
  if allocated > balance then raise exception 'insufficient source balance' using errcode = '22023'; end if;
  if src.in_balance then available := available + balance - allocated; end if;
  insert into public.budget_distributions(id, household_id, month, source_id, allocations, available_kopecks)
    values (p_id, hid, (date_trunc('month', p_date) + interval '1 month')::date, p_source, p_allocations, available)
    returning * into result;
  insert into public.transactions (household_id, from_id, to_id, amount_kopecks, occurred_at)
    select hid, p_source, key::uuid, value::bigint, p_date from jsonb_each_text(p_allocations) where value::bigint > 0;
  return result;
end;
$$;

create function public.save_monthly_plan(p_household uuid, p_month date, p_limits jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare item record;
begin
  if not public.is_member(p_household) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_month is null or extract(day from p_month) <> 1 or jsonb_typeof(p_limits) is distinct from 'object' then
    raise exception 'invalid monthly plan' using errcode = '22023'; end if;
  perform id from public.households where id = p_household for update;
  for item in select key, value from jsonb_each_text(p_limits) loop
    if item.value is null or item.value !~ '^\d+$' or item.value::numeric > 9999999900 or not exists (
      select 1 from public.entities where id = item.key::uuid and household_id = p_household and kind = 'expense' and not archived
    ) then raise exception 'invalid category limit' using errcode = '22023'; end if;
  end loop;
  if (select count(*) from jsonb_object_keys(p_limits)) <> (select count(*) from public.entities where household_id = p_household and kind = 'expense' and not archived) then
    raise exception 'categories changed' using errcode = '22023'; end if;
  insert into public.monthly_limits (household_id, month, entity_id, amount_kopecks)
    select p_household, p_month, key::uuid, value::bigint from jsonb_each_text(p_limits)
    on conflict (household_id, month, entity_id) do update set amount_kopecks = excluded.amount_kopecks;
  insert into public.monthly_plans values (p_household, p_month, now())
    on conflict (household_id, month) do update set saved_at = excluded.saved_at;
end;
$$;

revoke execute on function public.monthly_budget_state(date), public.save_category_limit(uuid,date,bigint),
  public.distribute_budget(uuid,uuid,jsonb,date), public.save_monthly_plan(uuid,date,jsonb) from public, anon;
grant execute on function public.monthly_budget_state(date), public.save_category_limit(uuid,date,bigint),
  public.distribute_budget(uuid,uuid,jsonb,date), public.save_monthly_plan(uuid,date,jsonb) to authenticated;
alter publication supabase_realtime add table public.households, public.monthly_limits, public.monthly_plans, public.budget_distributions;
