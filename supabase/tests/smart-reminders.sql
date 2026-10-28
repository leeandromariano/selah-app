-- New synthetic fixtures only. All rows and claims roll back.
\set ON_ERROR_STOP on
begin;
create temp table reminder_checks(label text);
grant insert on reminder_checks to authenticated;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label;end if;
insert into pg_temp.reminder_checks values(label);end $$;
create function pg_temp.denied(statement text) returns void language plpgsql as $$
begin begin execute statement;exception when insufficient_privilege then return;end;
raise exception 'FAIL: expected authorization rejection';end $$;
create temp table reminder_case(who uuid,other_user uuid,device uuid,content uuid,job uuid,value jsonb);
insert into reminder_case values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),null,null);
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select who,'reminder-'||who||'@example.invalid',now(),jsonb_build_object('username','rm_'||left(replace(who::text,'-',''),20),'whatsapp','+5511999990000') from reminder_case
 union all select other_user,'reminder-'||other_user||'@example.invalid',now(),jsonb_build_object('username','rm_'||left(replace(other_user::text,'-',''),20),'whatsapp','+5511999990000') from reminder_case;
create function pg_temp.identity(who uuid) returns void language sql as $$
 select set_config('request.jwt.claims',json_build_object('sub',who,'role','authenticated')::text,true)::text::void;
$$;
select pg_temp.identity(who) from reminder_case;
select pg_temp.ok(not (public.get_my_reminders()->>'enabled')::boolean,'no automatic opt in');
select pg_temp.ok(public.get_my_reminders()->'device'='null'::jsonb,'no automatic device');
update reminder_case set value=public.save_my_reminders(device,repeat('A',43),true,'08:17','America/Sao_Paulo','granted',
 jsonb_build_object('endpoint','https://push.test.invalid/'||device,'keys',jsonb_build_object('p256dh',repeat('A',87),'auth',repeat('A',22))),true);
select pg_temp.ok((select value->'device'->>'time'='08:17' and value->'device'->>'state'='active' from reminder_case),'explicit simulated enrollment');
select pg_temp.ok((select next_due_at>clock_timestamp() from private.push_devices where device_id=(select device from reminder_case)),'new settings schedule only future');
select pg_temp.ok((select not value::text ~ 'endpoint|p256dh|secret_hash|auth_key|user_id' from reminder_case),'own projection omits credentials');
select pg_temp.ok(not has_table_privilege('authenticated','private.push_devices','SELECT'),'readers including Owner Publisher have no subscription grant');
select pg_temp.ok(not has_table_privilege('service_role','private.push_devices','SELECT'),'no service API subscription access');
select pg_temp.ok(not has_function_privilege('authenticated','private.claim_reminders(timestamptz,integer,text)','EXECUTE'),'reader cannot schedule');
select pg_temp.ok(not has_function_privilege('authenticated','private.prepare_reminder(uuid,timestamptz)','EXECUTE'),'reader cannot dispatch');
select pg_temp.ok(not has_function_privilege('anon','public.get_my_reminders(uuid,text)','EXECUTE'),'anonymous cannot read');
select pg_temp.ok((select bool_and(relrowsecurity) from pg_class where oid in ('private.push_devices'::regclass,'private.reminder_attempts'::regclass,'public.reminder_preferences'::regclass)),'RLS on every personal table');
select pg_temp.identity(other_user) from reminder_case;
select pg_temp.ok((select public.get_my_reminders(device,repeat('A',43))->'device'='null'::jsonb from reminder_case),'other account cannot project device even with secret');
set local role authenticated;
select pg_temp.ok((select count(*)=0 from public.reminder_preferences),'RLS hides other account preference');
select pg_temp.denied('select * from private.push_devices');
select pg_temp.denied('select * from private.reminder_attempts');
select pg_temp.denied('select private.claim_reminders()');
reset role;
select pg_temp.denied(format('select public.revoke_my_push_device(%L, %L)',device,repeat('A',43))) from reminder_case;
select pg_temp.ok((select state='active' from private.push_devices where device_id=(select device from reminder_case)),'foreign revocation leaves device unchanged');
select pg_temp.identity(who) from reminder_case;
insert into public.devotionals(id,title,bible_reference,bible_text,content,reflection_question,publish_at,status,author_id)
 select content,'Devocional ficticio','Ref ficticia','Texto ficticio','Conteudo ficticio','Pergunta?', '2026-10-28T10:00:00Z','published',who from reminder_case;
update private.push_devices set next_due_at='2026-10-28T11:17:00Z',expires_at='2027-01-01T00:00:00Z';
update reminder_case set job=(select private.claim_reminders('2026-10-28T11:17:00Z'));
select pg_temp.ok((select job is not null from reminder_case),'due device reserved');
select pg_temp.ok(not exists(select private.claim_reminders('2026-10-28T11:17:01Z')),'second scheduler cannot claim same day');
update reminder_case set value=private.prepare_reminder(job,'2026-10-28T11:17:02Z');
select pg_temp.ok((select value->'payload'->>'kind'='reading' from reminder_case),'no completion chooses reading');
select private.finish_reminder(job,'simulated') from reminder_case;
insert into public.devotional_completions(user_id,source_devotional_id,revision,completed_at,completed_day)
 select who,gen_random_uuid(),1,'2026-10-28T11:18:00Z','2026-10-28' from reminder_case cross join generate_series(1,2);
update private.push_devices set next_due_at='2026-10-28T11:19:00Z';
select pg_temp.ok(not exists(select private.claim_reminders('2026-10-28T11:19:00Z')),'multiple later completions never generate second type');
select pg_temp.ok((select private.prepare_reminder(job,'2026-10-28T11:19:00Z') is null from reminder_case),'transport reservation cannot be reused');
-- Next day reserve first, complete second, decide immediately before sending.
update public.devotionals set publish_at='2026-10-29T10:00:00Z' where id=(select content from reminder_case);
update private.push_devices set next_due_at='2026-10-29T11:17:00Z';
update reminder_case set job=(select private.claim_reminders('2026-10-29T11:17:00Z'));
insert into public.devotional_completions(user_id,source_devotional_id,revision,completed_at,completed_day)
 select who,gen_random_uuid(),1,'2026-10-29T11:17:01Z','2026-10-29' from reminder_case;
update reminder_case set value=private.prepare_reminder(job,'2026-10-29T11:17:02Z');
select pg_temp.ok((select value->'payload'->>'kind'='share' from reminder_case),'completion between reservation and preparation chooses share');
select pg_temp.ok((select not (value->'payload')::text ~ 'user_id|email|whatsapp|streak|completed' from reminder_case),'payload excludes private performance and contacts');
select private.finish_reminder(job,'uncertain') from reminder_case;
update private.push_devices set next_due_at='2026-10-29T11:18:00Z';
select pg_temp.ok(not exists(select private.claim_reminders('2026-10-29T11:18:00Z')),'uncertain delivery is not retried');
-- No published devotional: consume the slot without claiming availability.
update private.push_devices set next_due_at='2026-10-30T11:17:00Z';
update reminder_case set job=(select private.claim_reminders('2026-10-30T11:17:00Z'));
select pg_temp.ok((select private.prepare_reminder(job,'2026-10-30T11:17:01Z') is null from reminder_case),'missing publication suppresses payload');
select pg_temp.ok((select status='unavailable' from private.reminder_attempts where id=(select job from reminder_case)),'unavailable reason recorded');
update public.devotionals set status='draft',publish_at='2026-10-31T10:00:00Z' where id=(select content from reminder_case);
update private.push_devices set next_due_at='2026-10-31T11:17:00Z';
update reminder_case set job=(select private.claim_reminders('2026-10-31T11:17:00Z'));
select pg_temp.ok((select private.prepare_reminder(job,'2026-10-31T11:17:01Z') is null from reminder_case),'draft produces no sharing destination');
update public.reminder_preferences set enabled=false where user_id=(select who from reminder_case);
update private.push_devices set next_due_at='2026-11-01T11:17:00Z';
select pg_temp.ok(not exists(select private.claim_reminders('2026-11-01T11:17:00Z')),'disabled preferences suppress reservations');
update public.reminder_preferences set enabled=true where user_id=(select who from reminder_case);
update private.push_devices set permission='denied';
select pg_temp.ok(not exists(select private.claim_reminders('2026-11-01T11:17:00Z')),'denied permission suppresses reservations');
update private.push_devices set permission='granted',state='revoked';
select pg_temp.ok(not exists(select private.claim_reminders('2026-11-01T11:17:00Z')),'revoked device suppresses reservations');
update private.push_devices set state='active',next_due_at='2026-11-01T11:17:00Z';
select pg_temp.ok(not exists(select private.claim_reminders('2026-11-01T12:17:00Z')),'scheduler outage does not replay stale notification');
select pg_temp.ok((select next_due_at>'2026-11-01T12:17:00Z' from private.push_devices where device_id=(select device from reminder_case)),'outage advances to next future schedule');
select pg_temp.ok(private.reminder_due_at('2026-03-08','02:30','America/New_York')='2026-03-08T07:00:00Z','DST gap uses first valid minute');
select pg_temp.ok(private.reminder_due_at('2026-11-01','01:30','America/New_York')='2026-11-01T05:30:00Z','DST overlap chooses earliest occurrence');
select pg_temp.ok(private.reminder_due_at('2011-12-30','08:00','Pacific/Apia') is null,'entire skipped civil date omitted');
select pg_temp.ok(('2026-10-28T01:00:00Z'::timestamptz at time zone 'Pacific/Auckland')::date='2026-10-28' and ('2026-10-28T01:00:00Z'::timestamptz at time zone 'America/Sao_Paulo')::date='2026-10-27','local next day does not redefine completion day');
select pg_temp.ok(('2026-10-28T04:00:00Z'::timestamptz at time zone 'America/Los_Angeles')::date='2026-10-27' and ('2026-10-28T04:00:00Z'::timestamptz at time zone 'America/Sao_Paulo')::date='2026-10-28','local previous day does not redefine completion day');
select pg_temp.ok(private.reminder_next_due('01:30','America/New_York','2026-11-01T06:00:00Z')='2026-11-02T06:30:00Z','DST repeated minute not replayed');
-- Membership must not turn Owner/editorial into subscription operators.
insert into private.admin_users(user_id) select other_user from reminder_case;
insert into private.app_owner(user_id) select other_user from reminder_case;
select pg_temp.identity(other_user) from reminder_case;
set local role authenticated;
select pg_temp.denied('select * from private.push_devices');
select pg_temp.denied('select private.claim_reminders()');
select pg_temp.ok((public.get_my_reminders()->>'enabled')='false','OWNER sees only own opt in');
reset role;
delete from private.app_owner where user_id=(select other_user from reminder_case);
set local role authenticated;
select pg_temp.denied('select * from private.push_devices');
select pg_temp.denied('select private.claim_reminders()');
reset role;
select pg_temp.ok(true,'editorial and Owner have no inherited device or scheduler access');
select pg_temp.identity(who) from reminder_case;
update private.push_devices set next_due_at='2026-11-02T11:17:00Z',expires_at='2027-01-01T00:00:00Z';
update reminder_case set job=(select private.claim_reminders('2026-11-02T11:17:00Z'));
update public.reminder_preferences set enabled=false where user_id=(select who from reminder_case);
select pg_temp.ok((select private.prepare_reminder(job,'2026-11-02T11:17:01Z') is null from reminder_case),'disable between claim and send cancels payload');
update public.reminder_preferences set enabled=true where user_id=(select who from reminder_case);
update private.push_devices set next_due_at='2026-11-03T02:59:59Z';
update reminder_case set job=(select private.claim_reminders('2026-11-03T02:59:59Z'));
select pg_temp.ok((select private.prepare_reminder(job,'2026-11-03T03:00:00Z') is null from reminder_case),'BRT midnight between claim and send cancels stale day');
create temp table reminder_session as select gen_random_uuid() id;
insert into auth.sessions(id,user_id,created_at,updated_at) select s.id,c.who,now(),now() from reminder_session s cross join reminder_case c;
update private.push_devices set session_id=(select id from reminder_session),next_due_at='2026-11-04T11:17:00Z';
delete from auth.sessions where id=(select id from reminder_session);
select pg_temp.ok(not exists(select private.claim_reminders('2026-11-04T11:17:00Z')),'revoked Auth session suppresses device after logout');
update private.push_devices set session_id=null,expires_at='2026-11-04T10:00:00Z';
select pg_temp.ok(not exists(select private.claim_reminders('2026-11-04T11:17:00Z')),'expired device never produces new intention');
select pg_temp.ok((select state='expired' and endpoint is null from private.push_devices where device_id=(select device from reminder_case)),'expiration clears endpoint and keys');
select count(*) || ' reminder SQL checks passed' from reminder_checks;
rollback;
