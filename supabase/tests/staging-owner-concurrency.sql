-- ONLY the new networkless disposable DB. Committed synthetic fixtures allow
-- independent backend sessions; the container and all rows are discarded.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('82000000-0000-4000-8000-000000000001','owner-race-a@example.invalid',now(),'{"username":"owner_race_a","whatsapp":"+5511999990000"}'),
 ('82000000-0000-4000-8000-000000000002','owner-race-b@example.invalid',now(),'{"username":"owner_race_b","whatsapp":"+5511999990000"}');
insert into private.admin_users(user_id) values
 ('82000000-0000-4000-8000-000000000001'),('82000000-0000-4000-8000-000000000002');
commit;
select extensions.dblink_connect_u('owner_a','host=/tmp dbname=postgres user=postgres');
select extensions.dblink_connect_u('owner_b','host=/tmp dbname=postgres user=postgres');
select extensions.dblink_connect_u('owner_session','host=/tmp dbname=postgres user=postgres');
-- The harness substitutes the actual candidate source, separately per session.
\echo MARKER_CANDIDATE
-- CANDIDATE_SETUP
\echo MARKER_HELPERS
select extensions.dblink_exec('owner_a',$q$create function pg_temp.try_owner(a text,u uuid,r text) returns text language plpgsql as $$begin
 perform pg_temp.staging_owner_candidate(a,u,u,r,true); return 'ok'; exception when others then return sqlstate; end; $$ $q$);
select extensions.dblink_exec('owner_b',$q$create function pg_temp.try_owner(a text,u uuid,r text) returns text language plpgsql as $$begin
 perform pg_temp.staging_owner_candidate(a,u,u,r,true); return 'ok'; exception when others then return sqlstate; end; $$ $q$);
select extensions.dblink_exec('owner_session',$q$create function pg_temp.try_rpc() returns text language plpgsql as $$begin
 perform public.get_owner_community(); perform public.get_owner_discussion(); return 'ok'; exception when others then return sqlstate; end; $$ $q$);
select extensions.dblink_exec('owner_session',$q$create function pg_temp.try_discussion() returns text language plpgsql as $$begin
 perform public.get_owner_discussion(); return 'ok'; exception when others then return sqlstate; end; $$ $q$);
\echo MARKER_GRANT
create temp table owner_backends as select * from extensions.dblink('owner_b','select pg_backend_pid()') t(pid integer);
create function pg_temp.wait_for_block() returns void language plpgsql as $$
declare deadline timestamptz:=clock_timestamp()+interval '4 seconds';
begin
 loop
  if exists(select 1 from owner_backends where cardinality(pg_blocking_pids(pid))>0) then return; end if;
  if clock_timestamp()>deadline then raise exception 'FAIL: concurrent operation did not wait on a database lock'; end if;
  perform pg_sleep(0.02);
 end loop;
end; $$;
create function pg_temp.check(v boolean,label text) returns void language plpgsql as $$begin
 if v is distinct from true then raise exception 'FAIL: %',label; end if;
end; $$;

-- Two real transactions: B starts while A has inserted but not committed.
select extensions.dblink_exec('owner_a','begin');
select extensions.dblink_exec('owner_b','begin');
select pg_temp.check((select code from extensions.dblink('owner_a',$q$select pg_temp.try_owner('grant','82000000-0000-4000-8000-000000000001','STAGING-racegrant1')$q$) t(code text))='ok','first grant');
select extensions.dblink_send_query('owner_b',$q$select pg_temp.try_owner('grant','82000000-0000-4000-8000-000000000002','STAGING-racegrant2')$q$);
select pg_temp.wait_for_block();
select extensions.dblink_exec('owner_a','commit');
select pg_temp.check((select code from extensions.dblink_get_result('owner_b') t(code text))='42501','second grant denied');
select * from extensions.dblink_get_result('owner_b') t(code text);
select extensions.dblink_exec('owner_b','commit');
select pg_temp.check((select count(*)=1 and bool_and(user_id='82000000-0000-4000-8000-000000000001') from private.app_owner)
 and (select count(*)=1 from private.owner_provision_audit where audit_ref like 'STAGING-racegrant%'),'one owner and one grant audit');

-- Keep the same authenticated backend and claims across the committed revoke.
select extensions.dblink_exec('owner_session',$q$set "request.jwt.claims"='{"sub":"82000000-0000-4000-8000-000000000001","role":"authenticated"}'$q$);
select extensions.dblink_exec('owner_session','set role authenticated');
select pg_temp.check((select code from extensions.dblink('owner_session','select pg_temp.try_rpc()') t(code text))='ok','old session allowed before revoke');
select extensions.dblink_exec('owner_a','begin');
select extensions.dblink_exec('owner_b','begin');
select pg_temp.check((select code from extensions.dblink('owner_a',$q$select pg_temp.try_owner('revoke','82000000-0000-4000-8000-000000000001','STAGING-racerevoke1')$q$) t(code text))='ok','first revoke');
select extensions.dblink_send_query('owner_b',$q$select pg_temp.try_owner('revoke','82000000-0000-4000-8000-000000000001','STAGING-racerevoke2')$q$);
select pg_temp.wait_for_block();
select extensions.dblink_exec('owner_a','commit');
select pg_temp.check((select code from extensions.dblink_get_result('owner_b') t(code text))='42501','second revoke denied');
select * from extensions.dblink_get_result('owner_b') t(code text);
select extensions.dblink_exec('owner_b','commit');
select pg_temp.check((select code from extensions.dblink('owner_session','select pg_temp.try_rpc()') t(code text))='42501','same old session denied after revoke');
select pg_temp.check((select code from extensions.dblink('owner_session','select pg_temp.try_discussion()') t(code text))='42501','same old session denied discussion after revoke');
select pg_temp.check(not exists(select 1 from private.app_owner) and
 (select count(*)=1 from private.owner_provision_audit where audit_ref like 'STAGING-racerevoke%'),'one revocation audit');

-- Deletion request commits first; a grant already waiting must recheck it.
select extensions.dblink_exec('owner_a','begin');
select extensions.dblink_exec('owner_b','begin');
select extensions.dblink_exec('owner_a',$q$insert into public.account_deletion_requests(user_id) values('82000000-0000-4000-8000-000000000001')$q$);
select extensions.dblink_send_query('owner_b',$q$select pg_temp.try_owner('grant','82000000-0000-4000-8000-000000000001','STAGING-deletefirst')$q$);
select pg_temp.wait_for_block();
select extensions.dblink_exec('owner_a','commit');
select pg_temp.check((select code from extensions.dblink_get_result('owner_b') t(code text))='42501','pending deletion denies waiting grant');
select * from extensions.dblink_get_result('owner_b') t(code text);
select extensions.dblink_exec('owner_b','commit');
select pg_temp.check(not exists(select 1 from private.app_owner) and not exists(select 1 from private.owner_provision_audit where audit_ref='STAGING-deletefirst'),'denied grant has no audit');
delete from public.account_deletion_requests where user_id='82000000-0000-4000-8000-000000000001';

-- Grant commits first; the waiting request then commits and immediately denies
-- the unchanged session even though membership is deliberately retained.
select extensions.dblink_exec('owner_a','begin');
select extensions.dblink_exec('owner_b','begin');
select pg_temp.check((select code from extensions.dblink('owner_a',$q$select pg_temp.try_owner('grant','82000000-0000-4000-8000-000000000001','STAGING-grantfirst')$q$) t(code text))='ok','grant before deletion');
select extensions.dblink_send_query('owner_b',$q$insert into public.account_deletion_requests(user_id) values('82000000-0000-4000-8000-000000000001') returning 1$q$);
select pg_temp.wait_for_block();
select extensions.dblink_exec('owner_a','commit');
select pg_temp.check((select n from extensions.dblink_get_result('owner_b') t(n integer))=1,'waiting deletion inserted');
select * from extensions.dblink_get_result('owner_b') t(n integer);
select extensions.dblink_exec('owner_b','commit');
select pg_temp.check((select code from extensions.dblink('owner_session','select pg_temp.try_rpc()') t(code text))='42501','deletion denies old session');
select pg_temp.check((select count(*)=1 from private.app_owner) and
 (select count(*)=1 from private.owner_provision_audit where audit_ref='STAGING-grantfirst'),'grant and audit retained with deletion request');

-- Audit uniqueness failure must roll back the membership change.
select pg_temp.check((select code from extensions.dblink('owner_a',$q$select pg_temp.try_owner('revoke','82000000-0000-4000-8000-000000000001','STAGING-grantfirst')$q$) t(code text))='23505','duplicate audit prevents revoke');
select pg_temp.check((select count(*)=1 from private.app_owner),'failed audit rolls back revoke');
select pg_temp.check((select code from extensions.dblink('owner_a',$q$select pg_temp.try_owner('revoke','82000000-0000-4000-8000-000000000001','STAGING-finalrevoke')$q$) t(code text))='ok','revoke still works with deletion pending');
select pg_temp.check(not exists(select 1 from private.app_owner) and (select count(*)=1 from private.owner_provision_audit where audit_ref='STAGING-finalrevoke'),'final revoke and audit');
delete from public.account_deletion_requests where user_id='82000000-0000-4000-8000-000000000001';
select pg_temp.check((select code from extensions.dblink('owner_a',$q$select pg_temp.try_owner('grant','82000000-0000-4000-8000-000000000001','STAGING-grantfirst')$q$) t(code text))='23505','duplicate audit prevents grant');
select pg_temp.check(not exists(select 1 from private.app_owner),'failed audit rolls back grant');

-- Auth deletion races a grant: the user-row lock delays deletion until grant
-- commits, then the existing FK cascade removes membership without a revoke
-- journal event. This is a documented limitation, not an audited revoke.
select extensions.dblink_exec('owner_a','begin');
select extensions.dblink_exec('owner_b','begin');
select pg_temp.check((select code from extensions.dblink('owner_a',$q$select pg_temp.try_owner('grant','82000000-0000-4000-8000-000000000002','STAGING-deleteusergrant')$q$) t(code text))='ok','grant before auth delete');
select extensions.dblink_send_query('owner_b',$q$delete from auth.users where id='82000000-0000-4000-8000-000000000002' returning 1$q$);
select pg_temp.wait_for_block();
select extensions.dblink_exec('owner_a','commit');
select pg_temp.check((select n from extensions.dblink_get_result('owner_b') t(n integer))=1,'waiting auth deletion completed');
select * from extensions.dblink_get_result('owner_b') t(n integer);
select extensions.dblink_exec('owner_b','commit');
select pg_temp.check(not exists(select 1 from private.app_owner) and
 (select count(*)=1 from private.owner_provision_audit where next_user_id='82000000-0000-4000-8000-000000000002' and action='grant') and
 not exists(select 1 from private.owner_provision_audit where previous_user_id='82000000-0000-4000-8000-000000000002' and action='revoke'),'auth cascade is not audited revoke');
select extensions.dblink_disconnect('owner_a');
select extensions.dblink_disconnect('owner_b');
select extensions.dblink_disconnect('owner_session');
select 'staging owner concurrency checks passed';
