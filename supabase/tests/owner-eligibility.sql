-- Synthetic accounts and role changes exist only in the disposable database.
\set ON_ERROR_STOP on
begin;
create temp table eligibility_checks(label text);
grant insert on eligibility_checks to authenticated;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$begin
  if value is distinct from true then raise exception 'FAIL: %',label; end if;
  insert into eligibility_checks values(label);
end $$;
create function pg_temp.denied(statement text,label text) returns void language plpgsql as $$begin
  begin execute statement; exception when sqlstate '42501' then insert into eligibility_checks values(label); return; end;
  raise exception 'FAIL: %',label;
end $$;
create function pg_temp.invalid_audit(ref text) returns void language plpgsql as $$begin
  begin insert into private.owner_provision_audit(action,next_user_id,audit_ref) values('grant',gen_random_uuid(),ref);
  exception when check_violation then insert into eligibility_checks values('invalid audit reference'); return; end;
  raise exception 'FAIL: invalid audit reference accepted';
end $$;
select pg_temp.ok(not has_function_privilege('authenticated','private.owner_identity()','EXECUTE')
  and not has_function_privilege('anon','private.owner_identity()','EXECUTE')
  and not has_function_privilege('service_role','private.owner_identity()','EXECUTE'),'owner helper has no API execution');
select pg_temp.ok((select prosecdef and proconfig @> array['search_path=""'] and pg_get_userbyid(proowner)='postgres'
  from pg_proc where oid='private.owner_identity()'::regprocedure),'owner helper has restricted definer and search path');
insert into private.owner_provision_audit(action,next_user_id,audit_ref) values
  ('grant',gen_random_uuid(),'LOCAL-testref_12345'),('grant',gen_random_uuid(),'STAGING-testref_12345');
select pg_temp.ok((select count(*)=2 from private.owner_provision_audit),'local and staging audit references accepted');
select pg_temp.invalid_audit('PROD-testref_12345');
select pg_temp.invalid_audit('STAGING-short');
select pg_temp.invalid_audit('STAGING-person@example.invalid');
create temp table eligibility_fixture(id uuid);
grant select on eligibility_fixture to authenticated;
insert into eligibility_fixture values(gen_random_uuid());
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select id,'eligibility-'||id||'@example.invalid',clock_timestamp(),jsonb_build_object('username','eligibility_owner','whatsapp','+5511999990000') from eligibility_fixture;
insert into private.app_owner(user_id) select id from eligibility_fixture;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from eligibility_fixture),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.ok(public.get_owner_community() is not null and public.get_owner_discussion() is not null,'active confirmed owner allowed');
reset role;
update auth.users set banned_until=clock_timestamp()+interval '1 day' where id=(select id from eligibility_fixture);
set local role authenticated;
select pg_temp.denied('select public.get_owner_community()','suspended owner cannot access community with existing claims');
select pg_temp.denied('select public.get_owner_discussion()','suspended owner cannot access moderation with existing claims');
reset role;
update auth.users set banned_until=null,email_confirmed_at=null where id=(select id from eligibility_fixture);
set local role authenticated;
select pg_temp.denied('select public.get_owner_community()','unconfirmed owner denied community');
select pg_temp.denied('select public.get_owner_discussion()','unconfirmed owner denied moderation');
reset role;
update auth.users set email_confirmed_at=clock_timestamp(),deleted_at=clock_timestamp() where id=(select id from eligibility_fixture);
set local role authenticated;
select pg_temp.denied('select public.get_owner_community()','deleted owner denied community');
select pg_temp.denied('select public.get_owner_discussion()','deleted owner denied moderation');
reset role;
update auth.users set deleted_at=null,is_anonymous=true where id=(select id from eligibility_fixture);
set local role authenticated;
select pg_temp.denied('select public.get_owner_community()','anonymous owner denied community');
select pg_temp.denied('select public.get_owner_discussion()','anonymous owner denied moderation');
reset role;
update auth.users set is_anonymous=false where id=(select id from eligibility_fixture);
insert into public.account_deletion_requests(user_id) select id from eligibility_fixture;
set local role authenticated;
select pg_temp.denied('select public.get_owner_community()','owner with deletion request denied community');
select pg_temp.denied('select public.get_owner_discussion()','owner with deletion request denied moderation');
select pg_temp.denied('select public.get_my_discussion_access()','owner with deletion request denied owner access probe');
reset role;
delete from public.account_deletion_requests where user_id=(select id from eligibility_fixture);
delete from private.app_owner where user_id=(select id from eligibility_fixture);
set local role authenticated;
select pg_temp.denied('select public.get_owner_community()','revoked owner denied community');
select pg_temp.denied('select public.get_owner_discussion()','revoked owner denied moderation');
select pg_temp.ok(public.get_my_discussion_access()=false,'revoked owner access probe returns false');
reset role;
select count(*)||' eligibility SQL checks passed' from eligibility_checks;
rollback;
