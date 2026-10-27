-- Categories that are never rounded up: spending on them goes in as is.
-- Holds entity ids without a foreign key, like roundup_skip_from.
alter table public.households
  add column roundup_skip_to uuid[] not null default '{}';

grant update (roundup_skip_to) on public.households to authenticated;
