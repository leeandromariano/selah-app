\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.rejected(statement text, expected text) returns void language plpgsql as $$
begin begin execute statement; exception when others then
if sqlstate=expected then return; end if; raise; end;
raise exception 'FAIL: expected rejection'; end $$;
select pg_temp.rejected($q$insert into auth.users(id,email) values ('72000000-0000-4000-8000-000000000001','username-missing@example.invalid')$q$,'23514');
select pg_temp.assert_true(not exists(select 1 from auth.users where id='72000000-0000-4000-8000-000000000001'),'missing username rolls back Auth row');
select pg_temp.rejected($q$insert into auth.users(id,raw_user_meta_data) values ('72000000-0000-4000-8000-000000000001','{"username":123}')$q$,'23514');
select pg_temp.rejected($q$insert into auth.users(id,raw_user_meta_data) values ('72000000-0000-4000-8000-000000000001','{"username":" ADMIN "}')$q$,'23514');
select pg_temp.rejected($q$insert into auth.users(id,raw_user_meta_data) values ('72000000-0000-4000-8000-000000000001','{"username":"inválido"}')$q$,'23514');
insert into auth.users(id,email,raw_user_meta_data) values
('72000000-0000-4000-8000-000000000001','username-one@example.invalid','{"username":" Sql_User_Name "}'),
('72000000-0000-4000-8000-000000000002','username-two@example.invalid','{"username":"sql_other_name"}');
select pg_temp.assert_true((select username='sql_user_name' from public.account_usernames where user_id='72000000-0000-4000-8000-000000000001'),'normalization in PostgreSQL');
select pg_temp.rejected($q$insert into auth.users(id,raw_user_meta_data) values ('72000000-0000-4000-8000-000000000003','{"username":"SQL_USER_NAME"}')$q$,'23505');
select pg_temp.assert_true(not exists(select 1 from auth.users where id='72000000-0000-4000-8000-000000000003'),'duplicate rolls back Auth row');
select pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.account_usernames'::regclass),'RLS enabled');
select pg_temp.assert_true((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='private.reserve_signup_username()'::regprocedure),'definer hardened');
set local role anon;
select pg_temp.rejected('select * from public.account_usernames','42501');
select pg_temp.rejected($q$insert into public.account_usernames(username) values ('forged_claim')$q$,'42501');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=1 from public.account_usernames),'reader only sees own username');
select pg_temp.assert_true((select count(*)=0 from public.account_usernames where user_id='72000000-0000-4000-8000-000000000002'),'other user hidden');
select pg_temp.rejected($q$update public.account_usernames set username='changed_name'$q$,'42501');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.account_usernames','DELETE'),'no delete privilege');
select pg_temp.rejected($q$insert into public.account_usernames(user_id,username) values ('72000000-0000-4000-8000-000000000002','forged_name')$q$,'42501');
select pg_temp.rejected('select private.reserve_signup_username()','42501');
reset role;
rollback;
select 'Username checks passed; fixtures rolled back.' as result;
