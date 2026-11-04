-- Run in an isolated local database after migrations. All test data is rolled back.
-- Bootstrap requires an administrative connection; RPC assertions run as authenticated.
begin;
insert into auth.users(id) values ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002'), ('10000000-0000-0000-0000-000000000003');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select public.create_household('Monthly test', 'Alice');
reset role;
insert into public.household_members(household_id,user_id,display_name)
select household_id,'10000000-0000-0000-0000-000000000002','Bob' from public.household_members where user_id = '10000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$
declare
  hid uuid;
  source uuid;
  recipient uuid;
  expense uuid;
  excluded uuid;
  request uuid := gen_random_uuid();
  d public.budget_distributions;
  n int;
  future date := (date_trunc('month',current_date) + interval '1 month')::date;
  current_month date := date_trunc('month',current_date)::date;
  state jsonb;
begin
  select household_id into hid from public.household_members limit 1;
  select id into source from public.entities where kind = 'account' order by position limit 1;
  select id into recipient from public.entities where kind = 'account' and id <> source limit 1;
  select id into expense from public.entities where kind = 'expense' limit 1;
  insert into public.entities (household_id,kind,name,in_balance) values (hid,'account','Savings',false) returning id into excluded;
  insert into public.transactions(household_id,to_id,amount_kopecks) values (hid,source,100000),(hid,recipient,900000);
  update public.households set distribution_source_id = source where id = hid;
  if (select distribution_source_id from public.households where id = hid) <> source then raise exception 'source setting not saved'; end if;
  d := public.distribute_budget(request,source,jsonb_build_object(recipient,30000,excluded,20000),current_date);
  if d.available_kopecks <> 80000 then raise exception 'wrong available %',d.available_kopecks; end if;
  select count(*) into n from public.transactions;
  perform public.distribute_budget(request,source,jsonb_build_object(recipient,30000,excluded,20000),current_date);
  if (select count(*) from public.transactions) <> n then raise exception 'duplicate transfers'; end if;
  begin
    perform public.distribute_budget(gen_random_uuid(),source,jsonb_build_object(recipient,999999),current_date);
    raise exception 'over-allocation was accepted';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.transactions) <> n then raise exception 'partial transfer'; end if;
  begin
    perform public.distribute_budget(request,source,jsonb_build_object(recipient,1),current_date);
    raise exception 'changed retry was accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.distribute_budget(gen_random_uuid(),source,jsonb_build_object(expense,1),current_date);
    raise exception 'expense recipient was accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.distribute_budget(gen_random_uuid(),source,jsonb_build_object(recipient,-1),current_date);
    raise exception 'negative amount was accepted';
  exception when invalid_parameter_value then null; end;
  perform public.distribute_budget(gen_random_uuid(),source,'{}'::jsonb,current_date);
  d := public.distribute_budget(gen_random_uuid(),excluded,jsonb_build_object(recipient,5000),current_date);
  if d.available_kopecks <> 5000 then raise exception 'excluded source remainder counted'; end if;
  perform public.save_category_limit(expense,current_month,1234);
  perform public.save_monthly_plan(hid,future,(select jsonb_object_agg(id,90000) from public.entities where kind = 'expense' and not archived));
  state := public.monthly_budget_state(current_month);
  if (state->'current_limits'->>expense::text)::bigint <> 1234 then raise exception 'future changed current'; end if;
  if (state->'next_limits'->>expense::text)::bigint <> 90000 or state->>'saved_at' is null then raise exception 'future not saved'; end if;
  -- Spending does not change either snapshot.
  insert into public.transactions(household_id,from_id,to_id,amount_kopecks) values (hid,source,expense,100);
  state := public.monthly_budget_state(future);
  if (state->'current_limits'->>expense::text)::bigint <> 90000 then raise exception 'rollover failed'; end if;
  state := public.monthly_budget_state((future + interval '2 months')::date);
  if (state->'current_limits'->>expense::text)::bigint <> 90000 then raise exception 'carry-forward failed'; end if;
  perform public.save_monthly_plan(hid,future,(select jsonb_object_agg(id,0) from public.entities where kind = 'expense' and not archived));
  if (public.monthly_budget_state(current_month)->'next_limits'->>expense::text)::bigint <> 0 then raise exception 'edit or zero limit failed'; end if;
  -- The partner can read the same results and edit the plan.
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
  if (public.monthly_budget_state(current_month)->'next_limits'->>expense::text)::bigint <> 0 then raise exception 'partner cannot read plan'; end if;
  perform public.save_category_limit(expense,current_month,4321);
  -- Unrelated users cannot read or mutate these records, including direct inserts.
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
  if exists(select 1 from public.budget_distributions) or exists(select 1 from public.monthly_limits) then raise exception 'RLS leak'; end if;
  begin
    perform public.distribute_budget(gen_random_uuid(),source,'{}'::jsonb,current_date);
    raise exception 'unauthorized distribution';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_category_limit(expense,current_month,1);
    raise exception 'unauthorized limit';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_monthly_plan(hid,future,'{}'::jsonb);
    raise exception 'unauthorized plan';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.monthly_limits values (hid,future,expense,1);
    raise exception 'direct write accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
