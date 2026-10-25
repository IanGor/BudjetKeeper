-- Round-ups: spending from an account is rounded up to 10 ₽, the category gets
-- the real price and the difference is transferred to one account of the budget
-- (the app records it as a second transaction, see AmountSheet). By default the
-- first account; null turns round-ups off.
alter table public.households
  add column roundup_account_id uuid references public.entities (id) on delete set null;

create function public.check_roundup_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.roundup_account_id is not null and not exists (
    select 1 from public.entities
    where id = new.roundup_account_id and household_id = new.id and kind = 'account'
  ) then
    raise exception 'round-ups go to an account of this household' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger households_roundup_account
before insert or update of roundup_account_id on public.households
for each row execute function public.check_roundup_account();

update public.households h
set roundup_account_id = (
  select e.id from public.entities e
  where e.household_id = h.id and e.kind = 'account' and not e.archived
  order by e.position, e.created_at
  limit 1
);

-- members may rename the budget and pick the round-up account, nothing else
-- (max_members and the invite code are not theirs to change)
revoke update on public.households from authenticated;
grant update (name, roundup_account_id) on public.households to authenticated;
