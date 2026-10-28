\set ON_ERROR_STOP on
begin;
create temp table owner_checks(label text);
grant insert on owner_checks to authenticated,anon;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if;
insert into pg_temp.owner_checks values(label); end $$;
create function pg_temp.denied(statement text,expected text default '42501') returns void language plpgsql as $$
begin begin execute statement; exception when others then
if sqlstate=expected then insert into pg_temp.owner_checks values('rejected'); return; end if;raise;end;
raise exception 'FAIL: expected rejection';end $$;
create temp table owner_fixture(name text, id uuid);
insert into owner_fixture select name,gen_random_uuid() from unnest(array['owner','a','b','c','d']) name;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select id,'owner22-'||id::text||'@example.invalid',clock_timestamp(),jsonb_build_object('username','owner22_'||name,'whatsapp','+5511999990000') from owner_fixture;
insert into private.admin_users(user_id) select id from owner_fixture where name in ('owner','d');
insert into private.app_owner(user_id) select id from owner_fixture where name='owner';
insert into public.devotional_completions(user_id,source_devotional_id,revision,completed_at,completed_day)
select f.id,gen_random_uuid(),1,(d::timestamp+interval '12 hours') at time zone 'America/Sao_Paulo',d
from owner_fixture f cross join lateral (
select (clock_timestamp() at time zone 'America/Sao_Paulo')::date+n as d
from unnest(case f.name when 'a' then array[-2,-1,-15,-14,-13,-12,-11] when 'b' then array[-1,0] when 'c' then array[-4,-3] else array[]::integer[] end) n) days;
select pg_temp.ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.get_owner_community(text,integer,integer)'::regprocedure),'definer has fixed empty search_path');
select pg_temp.ok(not has_function_privilege('anon','public.get_owner_community(text,integer,integer)','execute'),'anonymous has no execute');
select pg_temp.ok(not has_function_privilege('service_role','public.get_owner_community(text,integer,integer)','execute'),'service API no execute');
select pg_temp.ok(not has_table_privilege('authenticated','private.app_owner','select,insert,update,delete'),'owner membership inaccessible');
select pg_temp.ok((select relrowsecurity from pg_class where oid='private.app_owner'::regclass),'owner RLS');
select pg_temp.ok((select count(*)=1 from private.app_owner),'single owner, no automatic promotion of publisher');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from owner_fixture where name='owner'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.ok(jsonb_array_length(public.get_owner_community('owner22_')->'readers')=5,'owner sees all matching registered readers');
select pg_temp.ok((public.get_owner_community('owner22_a')->'readers'->0) @> '{"username":"owner22_a","current_streak":2,"best_streak":5,"total_days":7,"status":"pending_today"}','individual yesterday and historical record');
select pg_temp.ok((public.get_owner_community('owner22_b')->'readers'->0) @> '{"current_streak":2,"status":"completed_today"}','today classification');
select pg_temp.ok((public.get_owner_community('owner22_c')->'readers'->0) @> '{"current_streak":0,"best_streak":2,"status":"interrupted"}','interrupted classification');
select pg_temp.ok((public.get_owner_community('owner22_d')->'readers'->0) @> '{"current_streak":0,"best_streak":0,"total_days":0,"status":"empty"}','zero readers included');
select pg_temp.ok(public.get_owner_community('owner22_',0,1)->'readers'->0->>'username'='owner22_a' and public.get_owner_community('owner22_',1,1)->'readers'->0->>'username'='owner22_b','stable tie and pagination');
select pg_temp.ok(public.get_owner_community(' OWNER22_A ')->>'matched_readers'='1','case insensitive literal username search');
select pg_temp.ok(public.get_owner_community('nomatchingreader')->>'matched_readers'='0','empty search results');
select pg_temp.ok(not exists(select 1 from jsonb_object_keys(public.get_owner_community('owner22_a')->'readers'->0) k where k not in ('username','current_streak','best_streak','total_days','status')),'minimal projection no contacts IDs text time or openings');
select pg_temp.ok(public.get_owner_community()->>'server_today'=(clock_timestamp() at time zone 'America/Sao_Paulo')::date::text,'server civil timezone');
select pg_temp.ok(public.get_my_consistency()->>'current_streak'='0','owner own consistency remains isolated');
select pg_temp.ok((select count(*)=0 from public.devotional_completions),'owner cannot select third party ledger');
select pg_temp.denied($q$select public.get_owner_community('',-1,25)$q$,'22023');
select pg_temp.denied($q$select public.get_owner_community('',0,101)$q$,'22023');
select pg_temp.denied($q$select public.get_owner_community('%',0,25)$q$,'22023');
select pg_temp.denied($q$insert into private.app_owner(user_id) values(auth.uid())$q$);
reset role;
select pg_temp.ok((public.get_owner_community()->>'total_readers')::bigint=(select count(*) from auth.users where deleted_at is null and not coalesce(is_anonymous,false)),'documented universe and totals');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from owner_fixture where name='d'),'role','authenticated','app_metadata',jsonb_build_object('role','OWNER'),'user_metadata',jsonb_build_object('owner',true))::text,true);
set local role authenticated;
select pg_temp.denied('select public.get_owner_community()');
select pg_temp.ok(public.get_my_consistency()->>'status'='empty','editorial publisher still accesses own metrics');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from owner_fixture where name='a'),'role','authenticated','owner',true)::text,true);
set local role authenticated;
select pg_temp.denied('select public.get_owner_community()');
select pg_temp.denied('update private.app_owner set user_id=auth.uid()');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
set local role authenticated;
select pg_temp.denied('select public.get_owner_community()');
reset role;
set local role anon;
select pg_temp.denied('select public.get_owner_community()');
reset role;
select count(*)||' owner SQL checks passed; ROLLBACK complete.' from owner_checks;
rollback;
