-- Savings accounts can stay out of the total balance ("money available"):
-- the account keeps its own balance, it is just not added to the sum.
alter table public.entities
  add column in_balance boolean not null default true;

-- 99 999 999 ₽ is the largest plan (the app shows every digit of whole rubles
-- in a coin column, see formatRubWhole). Operations are capped by the keypad
-- only: an earlier balance adjustment in production is larger.
alter table public.entities
  add constraint entities_plan_max check (plan_kopecks is null or plan_kopecks <= 9999999900);
