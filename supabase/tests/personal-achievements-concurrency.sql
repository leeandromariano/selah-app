-- NEW disposable database only. Committed synthetic rows permit real overlap.
\set ON_ERROR_STOP on
begin;
create temp table reward_concurrent as select gen_random_uuid() who;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select who,'reward-overlap-'||who||'@example.invalid',clock_timestamp(),
 jsonb_build_object('username','rconc_'||left(replace(who::text,'-',''),16),'whatsapp','+5511999990000') from reward_concurrent;
commit;
select extensions.dblink_connect_u('rw_a','host=/tmp dbname=postgres user=postgres');
select extensions.dblink_connect_u('rw_b','host=/tmp dbname=postgres user=postgres');
select extensions.dblink_exec('rw_a','begin');
select extensions.dblink_exec('rw_b','begin');
select extensions.dblink_exec('rw_a',format('set local "request.jwt.claims"=%L',json_build_object('sub',who,'role','authenticated')::text)) from reward_concurrent;
select extensions.dblink_exec('rw_b',format('set local "request.jwt.claims"=%L',json_build_object('sub',who,'role','authenticated')::text)) from reward_concurrent;
select extensions.dblink_exec('rw_a','set local role authenticated');
select extensions.dblink_exec('rw_b','set local role authenticated');
select * from extensions.dblink('rw_a','select public.start_my_personal_challenge(7)::text') t(value text);
select extensions.dblink_send_query('rw_b','select public.start_my_personal_challenge(7)::text');
select pg_sleep(0.1);
do $$begin if extensions.dblink_is_busy('rw_b')<>1 then raise exception 'FAIL: challenge enrollment did not wait';end if;end$$;
select extensions.dblink_exec('rw_a','commit');
create temp table reward_second_start as select value::jsonb as value from extensions.dblink_get_result('rw_b') t(value text);
select * from extensions.dblink_get_result('rw_b') t(value text);
select extensions.dblink_exec('rw_b','commit');
do $$begin if (select count(*) from private.personal_challenges where user_id=(select who from reward_concurrent))<>1
 or (select value->'challenges'->0->>'target' from reward_second_start)<>'7' then raise exception 'FAIL: duplicate enrollment';end if;end$$;

-- Both requests cancel the same active enrollment while A retains the row lock.
select extensions.dblink_exec('rw_a','begin');
select extensions.dblink_exec('rw_b','begin');
select extensions.dblink_exec('rw_a',format('set local "request.jwt.claims"=%L',json_build_object('sub',who,'role','authenticated')::text)) from reward_concurrent;
select extensions.dblink_exec('rw_b',format('set local "request.jwt.claims"=%L',json_build_object('sub',who,'role','authenticated')::text)) from reward_concurrent;
select extensions.dblink_exec('rw_a','set local role authenticated');
select extensions.dblink_exec('rw_b','set local role authenticated');
select * from extensions.dblink('rw_a','select public.cancel_my_personal_challenge()::text') t(value text);
select extensions.dblink_send_query('rw_b','select public.cancel_my_personal_challenge()::text');
select pg_sleep(0.1);
do $$begin if extensions.dblink_is_busy('rw_b')<>1 then raise exception 'FAIL: cancellation did not wait';end if;end$$;
select extensions.dblink_exec('rw_a','commit');
create temp table reward_second_cancel as select value::jsonb as value from extensions.dblink_get_result('rw_b') t(value text);
select * from extensions.dblink_get_result('rw_b') t(value text);
select extensions.dblink_exec('rw_b','commit');
do $$begin if (select count(*) from private.personal_challenges where user_id=(select who from reward_concurrent) and cancelled_at is not null)<>1
 or (select value->'challenges'->0->>'status' from reward_second_cancel)<>'cancelled' then raise exception 'FAIL: cancellation retry not idempotent';end if;end$$;

-- Retry of start after committed cancellation cannot resurrect this week.
select extensions.dblink_exec('rw_a','begin');
select extensions.dblink_exec('rw_a',format('set local "request.jwt.claims"=%L',json_build_object('sub',who,'role','authenticated')::text)) from reward_concurrent;
select extensions.dblink_exec('rw_a','set local role authenticated');
create temp table reward_after_cancel as select value::jsonb as value from extensions.dblink('rw_a','select public.start_my_personal_challenge(7)::text') t(value text);
select extensions.dblink_exec('rw_a','commit');
do $$begin if (select value->'challenges'->0->>'status' from reward_after_cancel)<>'cancelled' then raise exception 'FAIL: cancelled enrollment restarted';end if;end$$;
do $$begin if (select count(*) from public.devotional_completions where user_id=(select who from reward_concurrent))<>0 then raise exception 'FAIL: challenge generated completion';end if;end$$;
select extensions.dblink_disconnect('rw_a');select extensions.dblink_disconnect('rw_b');
select '6 reward concurrency checks passed';
