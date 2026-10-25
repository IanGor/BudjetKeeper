-- Savings accounts can stay out of the total balance ("money available"):
-- the account keeps its own balance, it is just not added to the sum.
alter table public.entities
  add column in_balance boolean not null default true;

-- 99 999 999 ₽ is the largest amount of an operation or a plan (the app shows
-- every digit of whole rubles in a coin column, see formatRubWhole).
alter table public.transactions
  add constraint transactions_amount_max check (amount_kopecks <= 9999999900);
alter table public.entities
  add constraint entities_plan_max check (plan_kopecks is null or plan_kopecks <= 9999999900);
