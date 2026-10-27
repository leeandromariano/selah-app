\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', label; end if; end $$;
create function pg_temp.rejected(statement text) returns void language plpgsql as $$
begin begin execute statement; exception when insufficient_privilege then return; end;
raise exception 'FAIL: expected permission denial'; end $$;
select pg_temp.assert_true((select relrowsecurity from pg_class where oid='private.password_login_limits'::regclass), 'private budgets have RLS');
select pg_temp.assert_true(not has_table_privilege('anon','private.password_login_limits','SELECT'), 'anonymous cannot read budgets');
select pg_temp.assert_true(not has_table_privilege('authenticated','private.password_login_limits','SELECT'), 'reader cannot read budgets');
select pg_temp.assert_true(not has_table_privilege('service_role','private.password_login_limits','SELECT'), 'no service API budget access');
select pg_temp.assert_true((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='private.consume_password_login_attempt(text)'::regprocedure), 'definer has empty search path');
select pg_temp.assert_true(not has_function_privilege('anon','private.consume_password_login_attempt(text)','EXECUTE'), 'anonymous cannot consume budgets directly');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.consume_password_login_attempt(text)','EXECUTE'), 'reader cannot consume budgets directly');
select pg_temp.assert_true(not has_function_privilege('service_role','private.consume_password_login_attempt(text)','EXECUTE'), 'service API cannot consume budgets');
set local role anon;
select pg_temp.rejected('select * from private.password_login_limits');
select pg_temp.rejected($q$select private.consume_password_login_attempt(repeat('d',64))$q$);
reset role;
set local role authenticated;
select pg_temp.rejected('select * from private.password_login_limits');
select pg_temp.rejected($q$select private.consume_password_login_attempt(repeat('d',64))$q$);
reset role;
-- Controlled test windows only within this transaction; everything rolls back.
update private.password_login_limits set started_at=clock_timestamp()-interval '1 hour';
select pg_temp.assert_true(private.consume_password_login_attempt(repeat('d',64)), 'first attempt admitted');
select private.consume_password_login_attempt(repeat('d',64)) from generate_series(1,9);
select pg_temp.assert_true(not private.consume_password_login_attempt(repeat('d',64)), 'eleventh attempt refused');
select pg_temp.assert_true(not private.consume_password_login_attempt(repeat('d',64)), 'refusal persists across calls');
update private.password_login_limits set started_at=clock_timestamp()-interval '11 minutes' where bucket=repeat('d',64);
select pg_temp.assert_true(private.consume_password_login_attempt(repeat('d',64)), 'budget renews after window');
update private.password_login_limits set attempts=60 where bucket='global';
select pg_temp.assert_true(not private.consume_password_login_attempt(repeat('e',64)), 'global limit refuses fresh identifier');
update private.password_login_limits set started_at=clock_timestamp()-interval '2 minutes' where bucket='global';
select pg_temp.assert_true(private.consume_password_login_attempt(repeat('e',64)), 'global window renews');
select pg_temp.assert_true(not exists(select 1 from information_schema.routines where routine_schema='public' and routine_name like '%login%'), 'no public login or email-resolution RPC');
rollback;
select '19 password-login SQL checks passed; ROLLBACK complete.' as result;
