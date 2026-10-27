\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void
language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %', label; end if; end $$;
create function pg_temp.denied(statement text) returns void
language plpgsql as $$ begin
  begin execute statement; exception when insufficient_privilege then return; end;
  raise exception 'FAIL: expected permission denial';
end $$;
select pg_temp.assert_true((select is_nullable = 'YES' from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='name'), 'display name nullable');
select pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.account_deletion_requests'::regclass), 'requests RLS enabled');
insert into auth.users(id,email,raw_user_meta_data) values
('71000000-0000-4000-8000-000000000001','privacy-sql-one@example.invalid', jsonb_build_object('username','sql_' || left(replace(gen_random_uuid()::text,'-',''),20))),
('71000000-0000-4000-8000-000000000002','privacy-sql-two@example.invalid', jsonb_build_object('username','sql_' || left(replace(gen_random_uuid()::text,'-',''),20)));
set local role anon;
select pg_temp.denied('select * from public.account_deletion_requests');
select pg_temp.denied($q$insert into public.account_deletion_requests(user_id) values ('71000000-0000-4000-8000-000000000001')$q$);
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.profiles(id,name) values ('71000000-0000-4000-8000-000000000001',null);
select pg_temp.assert_true((select name is null and phone is null and age_range is null and instagram is null from public.profiles where id='71000000-0000-4000-8000-000000000001'), 'all profile fields optional');
insert into public.account_deletion_requests(user_id) values ('71000000-0000-4000-8000-000000000001');
select pg_temp.assert_true((select requested_at = now() from public.account_deletion_requests), 'server supplied timestamp');
select pg_temp.denied($q$insert into public.account_deletion_requests(user_id) values ('71000000-0000-4000-8000-000000000002')$q$);
select pg_temp.denied($q$update public.account_deletion_requests set requested_at='2000-01-01'$q$);
select pg_temp.assert_true(not has_table_privilege('authenticated','public.account_deletion_requests','DELETE'), 'no deletion privilege');
select pg_temp.assert_true(not has_column_privilege('authenticated','public.account_deletion_requests','requested_at','INSERT'), 'no client timestamp privilege');
select pg_temp.assert_true(not private.is_admin(), 'privacy actions do not grant admin');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=0 from public.account_deletion_requests), 'other request hidden');
select pg_temp.assert_true((select count(*)=0 from public.profiles), 'other profile hidden');
select pg_temp.denied($q$insert into public.account_deletion_requests(user_id,requested_at) values ('71000000-0000-4000-8000-000000000002','2000-01-01')$q$);
reset role;
select pg_temp.assert_true((select count(*)=2 from auth.users where id in ('71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002')), 'accounts preserved');
select pg_temp.assert_true((select count(*)=1 from public.profiles where id='71000000-0000-4000-8000-000000000001'), 'profile preserved');
rollback;
select 'Privacy checks passed; fixtures rolled back.' as result;
