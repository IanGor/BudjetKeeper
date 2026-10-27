-- Round-up settings of the budget (the «Округление» section of the app settings):
--   roundup_step      rounding step in kopecks, 10 ₽ by default
--   roundup_skip_from accounts whose spending is never rounded
-- The array holds entity ids without a foreign key: an id of a deleted account
-- just matches nothing.
alter table public.households
  add column roundup_step integer not null default 1000 check (roundup_step between 100 and 10000000),
  add column roundup_skip_from uuid[] not null default '{}';

grant update (roundup_step, roundup_skip_from) on public.households to authenticated;
