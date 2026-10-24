-- Closed budget: a household has at most max_members members (2 for now).
-- To let a third device/person in later: update households set max_members = 3.
-- Sign-ups are disabled in supabase/config.toml ([auth] enable_signup = false).

alter table public.households
  add column max_members smallint not null default 2 check (max_members between 1 and 10);

-- Members are inserted only by security-definer RPCs, but the limit is enforced here
-- so that no code path can bypass it. The household row is locked to serialize joins.
create function public.check_member_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  lim smallint;
begin
  select max_members into lim from public.households where id = new.household_id for update;
  if (select count(*) from public.household_members where household_id = new.household_id) >= lim then
    raise exception 'household is full' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger household_members_limit
before insert on public.household_members
for each row execute function public.check_member_limit();
