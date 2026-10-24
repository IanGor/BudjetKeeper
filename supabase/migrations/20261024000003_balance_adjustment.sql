-- Balance adjustments: a one-sided transaction on an account.
--   from_id is null -> money appears on to_id   (balance goes up)
--   to_id   is null -> money leaves from_id     (balance goes down)
-- Only accounts can be adjusted; income/expense totals are unaffected.
-- public.entity_totals() needs no change: it already sums to_id minus from_id.

alter table public.transactions alter column from_id drop not null;
alter table public.transactions alter column to_id drop not null;
alter table public.transactions
  add constraint transactions_has_side check (from_id is not null or to_id is not null);

create or replace function public.check_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  f public.entities;
  t public.entities;
begin
  if new.from_id is not null then
    select * into f from public.entities where id = new.from_id;
    if f.id is null or f.household_id <> new.household_id then
      raise exception 'entity does not belong to this household' using errcode = '22023';
    end if;
  end if;
  if new.to_id is not null then
    select * into t from public.entities where id = new.to_id;
    if t.id is null or t.household_id <> new.household_id then
      raise exception 'entity does not belong to this household' using errcode = '22023';
    end if;
  end if;

  -- adjustment
  if new.from_id is null or new.to_id is null then
    if coalesce(f.kind, t.kind) <> 'account' then
      raise exception 'only accounts can be adjusted' using errcode = '22023';
    end if;
    return new;
  end if;

  if not ((f.kind = 'income' and t.kind = 'account')
       or (f.kind = 'account' and t.kind in ('account', 'expense'))) then
    raise exception 'flow % -> % is not allowed', f.kind, t.kind using errcode = '22023';
  end if;

  return new;
end;
$$;
