-- Synthetic fixtures only in a NEW isolated PostgreSQL; everything rolls back.
\set ON_ERROR_STOP on
begin;
create temp table reward_checks(label text);
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if;
insert into pg_temp.reward_checks values(label); end $$;
create function pg_temp.reject(statement text,code text) returns void language plpgsql as $$
begin begin execute statement; exception when others then
if sqlstate=code then insert into pg_temp.reward_checks values('rejected');return;end if;raise;end;
raise exception 'FAIL: expected rejection';end $$;
grant insert on reward_checks to authenticated,anon;
create function pg_temp.today() returns date language sql as $$
select (clock_timestamp() at time zone 'America/Sao_Paulo')::date $$;
create function pg_temp.reader() returns uuid language plpgsql as $$
declare who uuid:=gen_random_uuid(); begin
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(who,
'rewards-'||who::text||'@example.invalid',clock_timestamp(),jsonb_build_object(
'username','rw_'||left(replace(who::text,'-',''),20),'whatsapp','+5511999990000'));
return who; end $$;
create function pg_temp.receipts(who uuid,days date[]) returns void language sql as $$
insert into public.devotional_completions(user_id,source_devotional_id,revision,completed_at,completed_day)
select who,gen_random_uuid(),1,(d::timestamp+interval '12 hours') at time zone 'America/Sao_Paulo',d from unnest(days)d $$;
create function pg_temp.read_as(who uuid) returns jsonb language plpgsql as $$
declare value jsonb; begin
perform set_config('request.jwt.claims',json_build_object('sub',who,'role','authenticated')::text,true);
set local role authenticated; value:=public.get_my_journey_rewards(); reset role; return value; end $$;

select pg_temp.ok((select relrowsecurity from pg_class where oid='private.personal_challenges'::regclass),'challenge RLS enabled');
select pg_temp.ok(not has_table_privilege('authenticated','private.personal_challenges','SELECT,INSERT,UPDATE,DELETE'),'no raw table privileges');
select pg_temp.ok(not has_function_privilege('anon','public.get_my_journey_rewards()','EXECUTE'),'anonymous cannot read rewards');
select pg_temp.ok(not has_function_privilege('service_role','public.start_my_personal_challenge(integer)','EXECUTE'),'no service API write grant');
select pg_temp.ok(not has_function_privilege('authenticated','private.journey_identity()','EXECUTE'),'helper not exposed');
set local role anon;
select pg_temp.reject('select public.get_my_journey_rewards()','42501');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select pg_temp.reject('select public.get_my_journey_rewards()','42501');
reset role;

do $$ declare n int; who uuid; value jsonb; begin
foreach n in array array[3,7,14,30,60,100,1001] loop
who:=pg_temp.reader();
-- Ended historical streak, duplicated receipts per day; no REST limit.
perform pg_temp.receipts(who,array(select pg_temp.today()-10-i from generate_series(0,n-1)i cross join generate_series(1,2)c));
value:=pg_temp.read_as(who);
perform pg_temp.ok((select count(*) from jsonb_array_elements(value->'badges') b where (b->>'unlocked')::boolean)=
  (select count(*) from unnest(array[3,7,14,30,60,100])t where t<=n),'historical permanent milestones '||n);
perform pg_temp.ok(public.get_my_consistency()->>'current_streak'='0','streak reset does not erase award '||n);
end loop; end $$;

select pg_temp.reader() as who \gset
select pg_temp.read_as(:'who');
select pg_temp.ok((select bool_and(not (b->>'unlocked')::boolean) from jsonb_array_elements(public.get_my_journey_rewards()->'badges')b),'no receipt means no badge');
select pg_temp.receipts(:'who',array[pg_temp.today(),pg_temp.today(),pg_temp.today()+1]);
select pg_temp.ok((select bool_and(not (b->>'unlocked')::boolean) from jsonb_array_elements(pg_temp.read_as(:'who')->'badges')b),'duplicates and future receipts cannot unlock three days');

do $$ declare n int; who uuid; monday date:=pg_temp.today()-(extract(isodow from pg_temp.today())::int-1); value jsonb; begin
foreach n in array array[3,5,7] loop
who:=pg_temp.reader();
insert into private.personal_challenges(user_id,week_start,target) values(who,monday-7,n);
perform pg_temp.receipts(who,array(select monday-7+i from generate_series(0,n-1)i cross join generate_series(1,2)c));
perform pg_temp.receipts(who,array[monday-8,monday]);
value:=pg_temp.read_as(who)->'challenges'->0;
perform pg_temp.ok(value->>'days'=n::text and value->>'status'='completed','weekly target completed exactly '||n);
end loop; end $$;

select pg_temp.reader() as participant \gset
select pg_temp.read_as(:'participant');
set local role authenticated;
select pg_temp.reject('select public.start_my_personal_challenge(4)','22023');
select pg_temp.reject('select public.start_my_personal_challenge(null)','22023');
select pg_temp.ok(public.start_my_personal_challenge(7)->'challenges'->0->>'status'='active','explicit start voluntary');
select pg_temp.ok(jsonb_array_length(public.start_my_personal_challenge(7)->'challenges')=1,'retry same target idempotent');
select pg_temp.reject('select public.start_my_personal_challenge(3)','40001');
select pg_temp.ok(public.cancel_my_personal_challenge()->'challenges'->0->>'status'='cancelled','own cancellation');
select pg_temp.ok(public.start_my_personal_challenge(7)->'challenges'->0->>'status'='cancelled','cannot restart cancelled week');
select pg_temp.reject('select * from private.personal_challenges','42501');
select pg_temp.reject('insert into private.personal_challenges(user_id,week_start,target) values(auth.uid(),current_date,3)','42501');
select pg_temp.reject('select public.get_my_journey_rewards(gen_random_uuid())','42883');
reset role;

select pg_temp.reader() as other \gset
insert into private.admin_users(user_id) values(:'other');
insert into private.app_owner(user_id) values(:'other');
select pg_temp.ok(jsonb_array_length(pg_temp.read_as(:'other')->'challenges')=0,'OWNER and editorial have only own rewards');
set local role authenticated;
select pg_temp.reject('select * from private.personal_challenges','42501');
reset role;
-- Defense in depth: even an accidental SELECT grant retains per-user RLS.
grant select on private.personal_challenges to authenticated;
set local role authenticated;
select pg_temp.ok((select count(*)=0 from private.personal_challenges where user_id=:'participant'),'RLS hides other account challenges including OWNER');
reset role;
revoke select on private.personal_challenges from authenticated;

select pg_temp.reader() as midweek \gset
select pg_temp.receipts(:'midweek',array[pg_temp.today()]);
select pg_temp.read_as(:'midweek');
set local role authenticated;
select pg_temp.ok(public.start_my_personal_challenge(3)->'challenges'->0->>'days'='1','earlier days in enrollment week count');
reset role;
select pg_temp.ok((select count(*)=1 from public.devotional_completions where user_id=:'midweek'),'enrollment never creates receipts');
select pg_temp.reader() as finished \gset
select pg_temp.receipts(:'finished',array[pg_temp.today()-7,pg_temp.today()-6,pg_temp.today()-5]);
insert into private.personal_challenges(user_id,week_start,target)
  values(:'finished',pg_temp.today()-(extract(isodow from pg_temp.today())::int-1)-7,7);
select pg_temp.ok(pg_temp.read_as(:'finished')->'challenges'->0->>'status'='ended','past unfinished week ends without penalty');
-- Empty current-week enrollment does not manufacture completion receipts.
select pg_temp.reader() as earned \gset
insert into private.personal_challenges(user_id,week_start,target)
  values(:'earned',pg_temp.today()-(extract(isodow from pg_temp.today())::int-1),3);
select pg_temp.ok((select count(*)=0 from public.devotional_completions where user_id=:'earned'),'new challenge with no receipts invents no result');
set local time zone 'Pacific/Auckland';
select pg_temp.ok(pg_temp.read_as(:'midweek')->>'server_today'=pg_temp.today()::text,'client/session timezone cannot change civil day');
select pg_temp.ok((date '2026-10-25'-(extract(isodow from date '2026-10-25')::int-1))=date '2026-10-19','Sunday belongs to previous Monday');
select pg_temp.ok((date '2026-10-26'-(extract(isodow from date '2026-10-26')::int-1))=date '2026-10-26','Monday starts next week');
select pg_temp.ok(('2026-10-28T02:59:59Z'::timestamptz at time zone 'America/Sao_Paulo')::date=date '2026-10-27','before Brasilia rollover');
select pg_temp.ok(('2026-10-28T03:00:00Z'::timestamptz at time zone 'America/Sao_Paulo')::date=date '2026-10-28','at Brasilia rollover');
-- Audit boundary coverage: just below each award, adjacent weeks and month change.
do $$ declare n int; who uuid; value jsonb; begin
foreach n in array array[3,7,14,30,60,100] loop
who:=pg_temp.reader();
perform pg_temp.receipts(who,array(select pg_temp.today()-10-i from generate_series(0,n-2)i));
value:=pg_temp.read_as(who);
perform pg_temp.ok(not (select (b->>'unlocked')::boolean from jsonb_array_elements(value->'badges')b where (b->>'days')::int=n),'threshold not awarded early '||n);
end loop; end $$;
select pg_temp.reader() as boundary_user \gset
insert into private.personal_challenges(user_id,week_start,target) values
(:'boundary_user',date '2024-09-30',5),(:'boundary_user',date '2024-10-07',3);
select pg_temp.receipts(:'boundary_user',array[date '2024-09-30',date '2024-10-01',date '2024-10-02',date '2024-10-03',date '2024-10-04',date '2024-10-07']);
select pg_temp.ok(pg_temp.read_as(:'boundary_user')->'challenges'->1->>'days'='5','week spans month boundary without losing days');
select pg_temp.ok(pg_temp.read_as(:'boundary_user')->'challenges'->0->>'days'='1','next week has independent enrollment and progress');
select pg_temp.reader() as frozen_user \gset
insert into private.personal_challenges(user_id,week_start,target,started_at,cancelled_at)
values(:'frozen_user',date '2024-09-30',7,'2024-09-30T12:00:00Z','2024-10-02T12:00:00Z');
select pg_temp.receipts(:'frozen_user',array[date '2024-09-30',date '2024-10-01',date '2024-10-03']);
select pg_temp.ok(pg_temp.read_as(:'frozen_user')->'challenges'->0->>'days'='2'
 and pg_temp.read_as(:'frozen_user')->'challenges'->0->>'status'='cancelled','later completion cannot revive cancelled challenge');
select count(*) as reward_sql_checks from reward_checks \gset
rollback;
\echo :reward_sql_checks reward SQL checks passed; ROLLBACK complete.
