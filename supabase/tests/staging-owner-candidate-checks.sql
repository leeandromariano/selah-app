\set ON_ERROR_STOP on
begin;
create temp table staging_checks(label text);
grant insert on staging_checks to authenticated;
create function pg_temp.staging_ok(v boolean, label text) returns void language plpgsql as $$ begin
 if v is distinct from true then raise exception 'FAIL: %',label; end if;
 insert into staging_checks values(label);
end $$;
create function pg_temp.staging_denied(statement text, expected text default '42501') returns void language plpgsql as $$ begin
 begin execute statement; exception when others then
   if sqlstate=expected then insert into staging_checks values('rejected'); return; end if; raise;
 end; raise exception 'FAIL: expected rejection';
end $$;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('81000000-0000-4000-8000-000000000001','synthetic-owner@example.invalid',now(),'{"username":"synthetic_owner","whatsapp":"+5511999990000"}'),
 ('81000000-0000-4000-8000-000000000002','synthetic-other@example.invalid',now(),'{"username":"synthetic_other","whatsapp":"+5511999990000"}');
insert into private.admin_users(user_id) values ('81000000-0000-4000-8000-000000000001');
select pg_temp.staging_denied($q$select pg_temp.staging_owner_candidate(null,'81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','STAGING-nullaction',true)$q$);
select pg_temp.staging_denied($q$select pg_temp.staging_owner_candidate('grant','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','STAGING-mismatch1',true)$q$);
update auth.users set banned_until=now()+interval '1 day' where id='81000000-0000-4000-8000-000000000001';
select pg_temp.staging_denied($q$select pg_temp.staging_owner_candidate('grant','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','STAGING-suspended1',true)$q$);
update auth.users set banned_until=null,deleted_at=now() where id='81000000-0000-4000-8000-000000000001';
select pg_temp.staging_denied($q$select pg_temp.staging_owner_candidate('grant','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','STAGING-deleted1',true)$q$);
update auth.users set deleted_at=null,email_confirmed_at=null where id='81000000-0000-4000-8000-000000000001';
select pg_temp.staging_denied($q$select pg_temp.staging_owner_candidate('grant','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','STAGING-unconfirmed1',true)$q$);
update auth.users set email_confirmed_at=now(),is_anonymous=true where id='81000000-0000-4000-8000-000000000001';
select pg_temp.staging_denied($q$select pg_temp.staging_owner_candidate('grant','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','STAGING-anonymous1',true)$q$);
update auth.users set is_anonymous=false where id='81000000-0000-4000-8000-000000000001';
select pg_temp.staging_denied($q$select pg_temp.staging_owner_candidate('grant','81000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000003','STAGING-missing123',true)$q$);
select pg_temp.staging_denied($q$select pg_temp.staging_owner_candidate('grant','81000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000002','STAGING-reader123',true)$q$);
select pg_temp.staging_denied($q$select pg_temp.staging_owner_candidate('grant','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','STAGING-noverify123',false)$q$);
insert into public.account_deletion_requests(user_id) values('81000000-0000-4000-8000-000000000001');
select pg_temp.staging_denied($q$select pg_temp.staging_owner_candidate('grant','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','STAGING-delete123',true)$q$);
delete from public.account_deletion_requests;
select pg_temp.staging_owner_candidate('grant','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','STAGING-grant123',true);
select pg_temp.staging_ok((select count(*)=1 from private.app_owner) and (select count(*)=1 from private.owner_provision_audit where audit_ref='STAGING-grant123'),'grant and audit');
select pg_temp.staging_denied($q$select pg_temp.staging_owner_candidate(null,'81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','STAGING-nullrevoke',true)$q$);
select pg_temp.staging_ok((select count(*)=1 from private.app_owner),'null action cannot revoke owner');
select pg_temp.staging_denied($q$select pg_temp.staging_owner_candidate('grant','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','STAGING-repeat123',true)$q$);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.staging_ok(public.get_owner_community() is not null and public.get_owner_discussion() is not null,'owner RPCs');
reset role;
select pg_temp.staging_denied($q$select pg_temp.staging_owner_candidate('revoke','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','STAGING-grant123',true)$q$,'23505');
select pg_temp.staging_ok((select count(*)=1 from private.app_owner),'audit error rolls back revoke');
select pg_temp.staging_owner_candidate('revoke','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','STAGING-revoke123',true);
set local role authenticated;
select pg_temp.staging_denied('select public.get_owner_community()');
select pg_temp.staging_denied('select public.get_owner_discussion()');
reset role;
select pg_temp.staging_ok((select count(*)=0 from private.app_owner) and (select count(*)=2 from private.owner_provision_audit where audit_ref in ('STAGING-grant123','STAGING-revoke123')),'revocation and audit');
select count(*)||' staging owner candidate checks passed' from staging_checks;
rollback;
