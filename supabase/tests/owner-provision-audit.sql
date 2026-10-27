\set ON_ERROR_STOP on
begin;
create temp table audit_checks(label text);
grant insert on audit_checks to authenticated,anon;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label;end if;insert into pg_temp.audit_checks values(label);end $$;
create function pg_temp.denied(statement text,expected text default '42501') returns void language plpgsql as $$
begin begin execute statement;exception when others then if sqlstate=expected then insert into pg_temp.audit_checks values('rejected');return;end if;raise;end;
raise exception 'FAIL: expected rejection';end $$;
select pg_temp.ok((select relrowsecurity from pg_class where oid='private.owner_provision_audit'::regclass),'audit RLS enabled');
select pg_temp.ok(not has_table_privilege('authenticated','private.owner_provision_audit','select,insert,update,delete'),'authenticated has no audit grants');
select pg_temp.ok(not has_table_privilege('anon','private.owner_provision_audit','select,insert,update,delete'),'anonymous has no audit grants');
select pg_temp.ok(not has_table_privilege('service_role','private.owner_provision_audit','select,insert,update,delete'),'service role has no audit grants');
set local role authenticated;
select pg_temp.denied('select * from private.owner_provision_audit');
select pg_temp.denied($q$insert into private.owner_provision_audit(action,audit_ref,next_user_id) values('grant','LOCAL-forged-reference',gen_random_uuid())$q$);
select pg_temp.denied('update private.owner_provision_audit set recorded_at=now()');
select pg_temp.denied('delete from private.owner_provision_audit');
reset role;
insert into private.owner_provision_audit(action,next_user_id,audit_ref) values('grant',gen_random_uuid(),'LOCAL-rollback-reference');
select pg_temp.ok((select recorded_at is not null and database_actor=session_user from private.owner_provision_audit where audit_ref='LOCAL-rollback-reference'),'operator timestamp and database actor persisted');
select pg_temp.denied($q$insert into private.owner_provision_audit(action,next_user_id,audit_ref) values('grant',gen_random_uuid(),'LOCAL-rollback-reference')$q$,'23505');
select pg_temp.denied($q$insert into private.owner_provision_audit(action,audit_ref) values('grant','LOCAL-rollback-invalid')$q$,'23514');
select pg_temp.denied($q$insert into private.owner_provision_audit(action,previous_user_id,next_user_id,audit_ref) values('transfer','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','LOCAL-rollback-self-transfer')$q$,'23514');
select pg_temp.denied($q$insert into private.owner_provision_audit(action,next_user_id,audit_ref) values('grant',gen_random_uuid(),'personal@example.invalid')$q$,'23514');
select count(*)||' owner audit SQL checks passed; ROLLBACK complete.' from audit_checks;
rollback;
