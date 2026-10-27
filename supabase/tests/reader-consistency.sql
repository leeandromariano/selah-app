-- Local only. Synthetic ledgers model elapsed civil days; never a client API.
-- No existing row is changed/deleted. Every fixture/parameter change rolls back.
\set ON_ERROR_STOP on
begin;
create temp table consistency_checks(label text);
grant insert on consistency_checks to anon,authenticated;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if;
insert into pg_temp.consistency_checks values(label); end $$;
create function pg_temp.rejected(statement text,code text) returns void language plpgsql as $$
begin begin execute statement; exception when others then
if sqlstate=code then insert into pg_temp.consistency_checks values('rejected');return;end if;raise;end;
raise exception 'FAIL: expected rejection';end $$;
create temp table consistency_today as select (clock_timestamp() at time zone 'America/Sao_Paulo')::date as day;
create function pg_temp.today() returns date language sql as $$ select day from pg_temp.consistency_today $$;
create function pg_temp.fixture(days date[],legacy boolean default false) returns uuid language plpgsql as $$
declare who uuid:=gen_random_uuid();
begin
  if legacy then
    -- Only this new pre-trigger fixture bypasses signup triggers, in rollback.
    set local session_replication_role=replica;
    insert into auth.users(id,email) values(who,'consistency-legacy-'||who::text||'@example.invalid');
    set local session_replication_role=origin;
    insert into public.profiles(id) values(who);
  else
    insert into auth.users(id,email,raw_user_meta_data) values(who,'consistency-'||who::text||'@example.invalid',
      jsonb_build_object('username','cs_'||left(replace(who::text,'-',''),20),'whatsapp','+5511999990000'));
  end if;
  insert into public.devotional_completions(user_id,source_devotional_id,revision,completed_at,completed_day)
    select who,gen_random_uuid(),1,(d::timestamp+interval '12 hours') at time zone 'America/Sao_Paulo',d from unnest(days) d;
  return who;
end $$;
create function pg_temp.read_as(who uuid,month date default null) returns jsonb language plpgsql as $$
declare result jsonb;
begin
  perform set_config('request.jwt.claims',json_build_object('sub',who,'role','authenticated')::text,true);
  set local role authenticated;
  result:=public.get_my_consistency(month);
  reset role;
  return result;
end $$;
create temp table consistency_case(who uuid,value jsonb);

select pg_temp.ok((select not prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.get_my_consistency(date)'::regprocedure),'RPC is invoker with empty search_path');
select pg_temp.ok(has_function_privilege('authenticated','public.get_my_consistency(date)','EXECUTE'),'authenticated may read own summary');
select pg_temp.ok(not has_function_privilege('anon','public.get_my_consistency(date)','EXECUTE'),'anonymous has no summary execute');
select pg_temp.ok(not has_function_privilege('service_role','public.get_my_consistency(date)','EXECUTE'),'no service API execute grant');
select pg_temp.ok((select relrowsecurity from pg_class where oid='public.devotional_completions'::regclass),'ledger RLS remains enabled');
select pg_temp.ok(not has_table_privilege('authenticated','public.devotional_completions','INSERT') and not has_table_privilege('authenticated','public.devotional_completions','UPDATE'),'reader cannot write day or counters');
select pg_temp.ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='devotional_completions' and indexname='devotional_completions_user_day_idx'),'user day index installed');
set local role anon;
select pg_temp.rejected('select public.get_my_consistency()','42501');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select pg_temp.rejected('select public.get_my_consistency()','42501');
reset role;

insert into consistency_case(who) values(pg_temp.fixture(array[]::date[]));
update consistency_case set value=pg_temp.read_as(who);
select pg_temp.ok((select value->>'status'='empty' and value->>'current_streak'='0' and value->>'best_streak'='0' from consistency_case),'no completions yields empty zero streak');
select pg_temp.ok((select value->>'total_days'='0' and value->>'total_devotionals'='0' and value->>'today_completed'='false' and value->>'last_completed_day' is null from consistency_case),'empty totals and pending today');
select pg_temp.ok((select value->>'server_today'=pg_temp.today()::text and value->>'time_zone'='America/Sao_Paulo' and value->>'first_month'=value->>'current_month' from consistency_case),'today and empty calendar bounds come from server');
select pg_temp.ok((select jsonb_array_length(value->'days') between 28 and 31 and not exists(select 1 from jsonb_array_elements(value->'days') d where (d->>'completions')::int<>0) from consistency_case),'empty calendar is complete with no invented days');
select pg_temp.rejected($q$select public.get_my_consistency(date '2026-10-02')$q$,'22023');
select pg_temp.rejected($q$select public.get_my_consistency(date '10000-01-01')$q$,'22023');
select pg_temp.rejected($q$select public.get_my_consistency(date '0001-01-01 BC')$q$,'22023');

update consistency_case set who=pg_temp.fixture(array[pg_temp.today()]);
update consistency_case set value=pg_temp.read_as(who);
select pg_temp.ok((select value->>'status'='completed_today' and value->>'current_streak'='1' and value->>'best_streak'='1' from consistency_case),'first conclusion starts one day');
select pg_temp.ok((select value->>'total_days'='1' and value->>'total_devotionals'='1' and value->>'today_completed'='true' from consistency_case),'first conclusion totals');

update consistency_case set who=pg_temp.fixture(array[pg_temp.today(),pg_temp.today(),pg_temp.today()]);
update consistency_case set value=pg_temp.read_as(who);
select pg_temp.ok((select value->>'current_streak'='1' and value->>'total_days'='1' and value->>'total_devotionals'='3' from consistency_case),'multiple completions same day count once for streak');
select pg_temp.ok((select exists(select 1 from jsonb_array_elements(value->'days') d where d->>'date'=pg_temp.today()::text and d->>'completions'='3') from consistency_case),'calendar keeps per-day completion count');

update consistency_case set who=pg_temp.fixture(array[pg_temp.today()-2,pg_temp.today()-1,pg_temp.today()]);
update consistency_case set value=pg_temp.read_as(who);
select pg_temp.ok((select value->>'current_streak'='3' and value->>'best_streak'='3' and value->>'status'='completed_today' from consistency_case),'three consecutive days ending today');
update consistency_case set who=pg_temp.fixture(array[pg_temp.today()-3,pg_temp.today()-2,pg_temp.today()-1]);
update consistency_case set value=pg_temp.read_as(who);
select pg_temp.ok((select value->>'current_streak'='3' and value->>'status'='pending_today' and value->>'today_completed'='false' from consistency_case),'yesterday keeps active streak pending today');
update consistency_case set who=pg_temp.fixture(array[pg_temp.today()-4,pg_temp.today()-3,pg_temp.today()-2]);
update consistency_case set value=pg_temp.read_as(who);
select pg_temp.ok((select value->>'current_streak'='0' and value->>'best_streak'='3' and value->>'status'='interrupted' from consistency_case),'full missed day interrupts and preserves record');
update consistency_case set who=pg_temp.fixture(array[pg_temp.today()-10,pg_temp.today()-9,pg_temp.today()-8,pg_temp.today()-7,pg_temp.today()-6,pg_temp.today()]);
update consistency_case set value=pg_temp.read_as(who);
select pg_temp.ok((select value->>'current_streak'='1' and value->>'best_streak'='5' and value->>'total_days'='6' from consistency_case),'restart after interruption preserves larger record');
update consistency_case set who=pg_temp.fixture(array[pg_temp.today()-10,pg_temp.today()-9,pg_temp.today()-8,pg_temp.today()-7,pg_temp.today()-6,pg_temp.today()-1,pg_temp.today()]);
update consistency_case set value=pg_temp.read_as(who);
select pg_temp.ok((select value->>'current_streak'='2' and value->>'best_streak'='5' and value->>'total_days'='7' from consistency_case),'new consecutive run grows independently of historical record');
select pg_temp.ok((select pg_temp.read_as(who)-'server_now'=value-'server_now' from consistency_case),'repeated reads do not alter any metric');
select pg_temp.ok((select count(*)=7 from public.devotional_completions where user_id=(select who from consistency_case)),'aggregation never writes new completions');

update consistency_case set who=pg_temp.fixture(array[date '2018-12-31',date '2019-01-01']);
update consistency_case set value=pg_temp.read_as(who,date '2018-12-01');
select pg_temp.ok((select value->>'best_streak'='2' and value->>'current_streak'='0' and jsonb_array_length(value->'days')=31 and value->'days'->30->>'completions'='1' from consistency_case),'calendar December and streak across year boundary');
update consistency_case set value=pg_temp.read_as(who,date '2019-01-01');
select pg_temp.ok((select value->'days'->0->>'date'='2019-01-01' and value->'days'->0->>'completions'='1' and value->>'total_days'='2' from consistency_case),'January selection changes calendar only');
select pg_temp.ok((select jsonb_array_length(pg_temp.read_as(who,date '2024-02-01')->'days')=29 from consistency_case),'leap February has 29 days');
select pg_temp.ok((select jsonb_array_length(pg_temp.read_as(who,date '1900-02-01')->'days')=28 from consistency_case),'nonleap century has 28 days');
select pg_temp.ok((select jsonb_array_length(pg_temp.read_as(who,date '2000-02-01')->'days')=29 from consistency_case),'leap century has 29 days');
select pg_temp.ok((select pg_temp.read_as(who,date '0001-01-01')->'days'->0->>'date'='0001-01-01' from consistency_case),'minimum calendar year supported');
select pg_temp.ok((select pg_temp.read_as(who,date '9999-12-01')->'days'->30->>'date'='9999-12-31' from consistency_case),'maximum calendar year is bounded to 31 cells');

select pg_temp.ok(('2026-10-28T02:59:59Z'::timestamptz at time zone 'America/Sao_Paulo')::date=date '2026-10-27','before Brasilia midnight');
select pg_temp.ok(('2026-10-28T03:00:00Z'::timestamptz at time zone 'America/Sao_Paulo')::date=date '2026-10-28','at Brasilia midnight');
select pg_temp.ok(('2018-11-04T02:59:59Z'::timestamptz at time zone 'America/Sao_Paulo')::date=date '2018-11-03','historical DST before jump');
select pg_temp.ok(('2018-11-04T03:00:00Z'::timestamptz at time zone 'America/Sao_Paulo')::date=date '2018-11-04','historical DST jump civil day');
select pg_temp.ok(('2019-02-17T02:00:00Z'::timestamptz at time zone 'America/Sao_Paulo')::date=date '2019-02-16','historical DST repeated hour stays previous day');
update consistency_case set who=pg_temp.fixture(array[date '2018-11-03',date '2018-11-04']);
update consistency_case set value=pg_temp.read_as(who,date '2018-11-01');
set local time zone 'Pacific/Auckland';
select pg_temp.ok((select pg_temp.read_as(who,date '2018-11-01')-'server_now'=value-'server_now' from consistency_case),'session time zone does not reinterpret frozen days or server today');
set local time zone 'UTC';

update consistency_case set who=pg_temp.fixture(array(select pg_temp.today()-n from generate_series(0,2999)n cross join generate_series(1,2)copies));
update consistency_case set value=pg_temp.read_as(who);
select pg_temp.ok((select value->>'current_streak'='3000' and value->>'best_streak'='3000' and value->>'total_days'='3000' and value->>'total_devotionals'='6000' from consistency_case),'many records aggregate completely beyond REST page limits');
select pg_temp.ok((select jsonb_array_length(value->'days')<=31 from consistency_case),'large history response keeps one bounded month');
update consistency_case set who=pg_temp.fixture(array[pg_temp.today()],true);
update consistency_case set value=pg_temp.read_as(who);
select pg_temp.ok((select value->>'current_streak'='1' and not exists(select 1 from public.account_usernames where user_id=who) from consistency_case),'legacy account without username can read its consistency');
select pg_temp.ok((select exists(select 1 from public.profiles p where p.id=who and p.phone is null) from consistency_case),'legacy phone remains empty and unchanged');
update consistency_case set who=pg_temp.fixture(array[pg_temp.today(),pg_temp.today()+1]);
update consistency_case set value=pg_temp.read_as(who);
select pg_temp.ok((select value->>'current_streak'='1' and value->>'total_days'='1' and value->>'total_devotionals'='1' from consistency_case),'future anomalous receipts cannot advance metrics before civil day');

select pg_temp.fixture(array[pg_temp.today()-2,pg_temp.today()-1,pg_temp.today()]) as first_user \gset
select pg_temp.fixture(array[pg_temp.today()]) as second_user \gset
insert into private.admin_users(user_id) values (:'second_user');
select pg_temp.ok(pg_temp.read_as(:'first_user')->>'current_streak'='3','first reader metrics have own scope');
select pg_temp.ok(pg_temp.read_as(:'second_user')->>'current_streak'='1','administrator gets own metrics only');
select set_config('request.jwt.claims',json_build_object('sub',:'second_user','role','authenticated')::text,true);
set local role authenticated;
select pg_temp.ok((select count(*)=0 from public.devotional_completions where user_id=:'first_user'),'administrator cannot read another reader ledger');
select pg_temp.rejected($q$select public.get_my_consistency(null,'10000000-0000-4000-8000-000000000001'::uuid)$q$,'42883');
reset role;
select pg_temp.ok((select value->>'server_today'=pg_temp.today()::text from consistency_case),'all fixtures completed in same trusted test civil day');
select count(*) as consistency_sql_checks from consistency_checks \gset
rollback;
\echo :consistency_sql_checks consistency SQL checks passed; ROLLBACK complete.
