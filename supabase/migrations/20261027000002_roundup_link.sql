-- A round-up operation belongs to the spending it came from: deleting the
-- spending deletes it too.
alter table public.transactions
  add column roundup_of uuid references public.transactions (id) on delete cascade;

create index transactions_roundup_of on public.transactions (roundup_of) where roundup_of is not null;

-- Link the round-ups recorded before: they were saved together with their spending
-- (the same created_at) from the same account on the same day. Only unambiguous pairs.
update public.transactions r
set roundup_of = (
  select p.id from public.transactions p
  where p.household_id = r.household_id
    and p.created_at = r.created_at
    and p.from_id = r.from_id
    and p.occurred_at = r.occurred_at
    and p.comment is distinct from 'Округление'
    and p.id <> r.id
)
where r.comment = 'Округление'
  and (
    select count(*) from public.transactions p
    where p.household_id = r.household_id and p.created_at = r.created_at and p.from_id = r.from_id
      and p.occurred_at = r.occurred_at and p.comment is distinct from 'Округление' and p.id <> r.id
  ) = 1;
