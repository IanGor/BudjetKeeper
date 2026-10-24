-- BudjetKeeper: shared household budget (income sources -> accounts -> expense categories)
-- Amounts are stored in kopecks (bigint), never as floats.

create type public.entity_kind as enum ('income', 'account', 'expense');

-- ---------------------------------------------------------------- tables

create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 60),
  invite_code text not null unique
              default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 40),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
-- a user belongs to exactly one household
create unique index household_members_user_uq on public.household_members (user_id);

create table public.entities (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind         public.entity_kind not null,
  name         text not null check (length(btrim(name)) between 1 and 40),
  icon         text not null default 'wallet',
  color        text not null default '#d9a441',
  plan_kopecks bigint check (plan_kopecks is null or plan_kopecks >= 0),
  position     integer not null default 0,
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index entities_household_idx on public.entities (household_id);

create table public.transactions (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  from_id        uuid not null references public.entities (id) on delete restrict,
  to_id          uuid not null references public.entities (id) on delete restrict,
  amount_kopecks bigint not null check (amount_kopecks > 0),
  comment        text check (comment is null or length(comment) <= 200),
  occurred_at    date not null default current_date,
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  check (from_id <> to_id)
);
create index transactions_household_date_idx on public.transactions (household_id, occurred_at desc);
create index transactions_from_idx on public.transactions (from_id);
create index transactions_to_idx on public.transactions (to_id);

-- ---------------------------------------------------------------- helpers

create function public.is_member(hid uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
  );
$$;

-- Allowed flows: income -> account, account -> expense, account -> account.
-- Runs as the caller, so RLS hides entities of other households (null check below).
create function public.check_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  f public.entities;
  t public.entities;
begin
  select * into f from public.entities where id = new.from_id;
  select * into t from public.entities where id = new.to_id;

  if f.id is null or t.id is null
     or f.household_id <> new.household_id or t.household_id <> new.household_id then
    raise exception 'entity does not belong to this household' using errcode = '22023';
  end if;

  if not ((f.kind = 'income' and t.kind = 'account')
       or (f.kind = 'account' and t.kind in ('account', 'expense'))) then
    raise exception 'flow % -> % is not allowed', f.kind, t.kind using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger transactions_check
before insert or update on public.transactions
for each row execute function public.check_transaction();

-- kind and household are fixed once an entity exists (transactions depend on them)
create function public.freeze_entity_kind()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind <> old.kind or new.household_id <> old.household_id then
    raise exception 'entity kind and household cannot be changed' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger entities_freeze_kind
before update on public.entities
for each row execute function public.freeze_entity_kind();

-- ---------------------------------------------------------------- RLS

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.entities          enable row level security;
alter table public.transactions      enable row level security;

create policy households_select on public.households
  for select to authenticated using (public.is_member(id));
create policy households_update on public.households
  for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

create policy members_select on public.household_members
  for select to authenticated using (public.is_member(household_id));
create policy members_update_self on public.household_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy members_leave on public.household_members
  for delete to authenticated using (user_id = auth.uid());

create policy entities_all on public.entities
  for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

create policy transactions_select on public.transactions
  for select to authenticated using (public.is_member(household_id));
create policy transactions_insert on public.transactions
  for insert to authenticated
  with check (public.is_member(household_id) and created_by = auth.uid());
create policy transactions_update on public.transactions
  for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy transactions_delete on public.transactions
  for delete to authenticated using (public.is_member(household_id));

revoke all on public.households, public.household_members, public.entities, public.transactions from anon;

-- ---------------------------------------------------------------- RPC

create function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'already a member of a household' using errcode = '23505';
  end if;

  insert into public.households (name) values (btrim(p_name)) returning id into hid;
  insert into public.household_members (household_id, user_id, display_name)
  values (hid, auth.uid(), btrim(p_display_name));

  insert into public.entities (household_id, kind, name, icon, color, position) values
    (hid, 'income',  'Зарплата',    'briefcase',     '#6fbf73', 0),
    (hid, 'account', 'Наличные',    'wallet',        '#d9a441', 0),
    (hid, 'account', 'Карта',       'credit-card',   '#d9a441', 1),
    (hid, 'expense', 'Продукты',    'shopping-cart', '#e0b44c', 0),
    (hid, 'expense', 'Кафе',        'coffee',        '#e0b44c', 1),
    (hid, 'expense', 'Транспорт',   'bus',           '#e0b44c', 2),
    (hid, 'expense', 'Дом',         'house',         '#e0b44c', 3),
    (hid, 'expense', 'Здоровье',    'heart-pulse',   '#e0b44c', 4),
    (hid, 'expense', 'Развлечения', 'gamepad-2',     '#e0b44c', 5),
    (hid, 'expense', 'Одежда',      'shirt',         '#e0b44c', 6),
    (hid, 'expense', 'Связь',       'smartphone',    '#e0b44c', 7);

  return hid;
end;
$$;

create function public.join_household(p_invite_code text, p_display_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'already a member of a household' using errcode = '23505';
  end if;

  select id into hid from public.households
  where invite_code = upper(btrim(p_invite_code));
  if hid is null then
    raise exception 'invite code not found' using errcode = 'P0002';
  end if;

  insert into public.household_members (household_id, user_id, display_name)
  values (hid, auth.uid(), btrim(p_display_name));
  return hid;
end;
$$;

-- Account: balance for all time. Income source / category: total for the month of p_month.
create function public.entity_totals(p_month date)
returns table (entity_id uuid, total_kopecks bigint)
language sql stable
set search_path = ''
as $$
  with bounds as (
    select date_trunc('month', p_month)::date as s,
           (date_trunc('month', p_month) + interval '1 month')::date as e
  )
  select e.id,
    (case e.kind
      when 'account' then
          coalesce((select sum(t.amount_kopecks) from public.transactions t where t.to_id = e.id), 0)
        - coalesce((select sum(t.amount_kopecks) from public.transactions t where t.from_id = e.id), 0)
      when 'income' then
        coalesce((select sum(t.amount_kopecks) from public.transactions t, bounds b
                  where t.from_id = e.id and t.occurred_at >= b.s and t.occurred_at < b.e), 0)
      else
        coalesce((select sum(t.amount_kopecks) from public.transactions t, bounds b
                  where t.to_id = e.id and t.occurred_at >= b.s and t.occurred_at < b.e), 0)
    end)::bigint
  from public.entities e;
$$;

revoke execute on function public.is_member(uuid), public.create_household(text, text),
  public.join_household(text, text), public.entity_totals(date) from public, anon;
grant execute on function public.is_member(uuid), public.create_household(text, text),
  public.join_household(text, text), public.entity_totals(date) to authenticated;

-- ---------------------------------------------------------------- realtime

alter publication supabase_realtime
  add table public.entities, public.transactions, public.household_members;
