-- ONLY the NEW disposable database: committed fictional fixtures are needed
-- for two independent database connections. Never run on an existing stack.
\set ON_ERROR_STOP on
begin;
create temp table concurrency_ids as select gen_random_uuid() who,gen_random_uuid() device;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select who,'concurrency-'||who||'@example.invalid',now(),jsonb_build_object('username','cc_'||left(replace(who::text,'-',''),20),'whatsapp','+5511999990000') from concurrency_ids;
insert into public.reminder_preferences(user_id,enabled) select who,true from concurrency_ids;
insert into private.push_devices(device_id,user_id,secret_hash,mode,state,permission,local_time,timezone,next_due_at,expires_at)
 select device,who,extensions.digest(repeat('B',43),'sha256'),'simulation','active','granted','08:00','UTC','2030-01-01T08:00:00Z','2030-03-01T00:00:00Z' from concurrency_ids;
commit;
select extensions.dblink_connect_u('reminder_a','host=/tmp dbname=postgres user=postgres');
select extensions.dblink_connect_u('reminder_b','host=/tmp dbname=postgres user=postgres');
select extensions.dblink_exec('reminder_a','begin');
select extensions.dblink_exec('reminder_b','begin');
create temp table overlap_counts as select n from extensions.dblink('reminder_a',$q$select count(*)::integer from private.claim_reminders('2030-01-01T08:00:00Z')$q$) t(n integer);
insert into overlap_counts select n from extensions.dblink('reminder_b',$q$select count(*)::integer from private.claim_reminders('2030-01-01T08:00:00Z')$q$) t(n integer);
do $$begin if (select sum(n) from overlap_counts)<>1 then raise exception 'FAIL: overlapping claims duplicated';end if;end$$;
select extensions.dblink_exec('reminder_a','commit');
select extensions.dblink_exec('reminder_b','rollback');
do $$begin if (select count(*) from private.reminder_attempts where device_id=(select device from concurrency_ids))<>1 then raise exception 'FAIL: daily reservation not unique';end if;end$$;
select extensions.dblink_disconnect('reminder_a');
select extensions.dblink_disconnect('reminder_b');
select '2 overlapping transaction checks passed';
