-- Local only. Synthetic fixtures and server-clock boundary setup all ROLLBACK.
-- The seeded 59,999/60,000 boundary is not a substitute for the real-time HTTP test.
\set ON_ERROR_STOP on
begin;
create temp table reading_checks (label text);
grant insert, select on reading_checks to anon, authenticated;
create function pg_temp.ok(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if;
insert into pg_temp.reading_checks values (label); end $$;
create function pg_temp.denied(statement text) returns void language plpgsql as $$
begin begin execute statement; exception when insufficient_privilege then
insert into pg_temp.reading_checks values ('denied'); return; end;
raise exception 'FAIL: expected permission denial'; end $$;
create temp table reading_result (value jsonb);
insert into reading_result values ('{}');
grant select, update on reading_result to authenticated;

insert into auth.users(id,email,raw_user_meta_data) values
('81000000-0000-4000-8000-000000000001','reading-sql-one@example.invalid',jsonb_build_object('username','rs_'||left(replace(gen_random_uuid()::text,'-',''),20),'whatsapp','+5511999990000')),
('81000000-0000-4000-8000-000000000002','reading-sql-two@example.invalid',jsonb_build_object('username','rs_'||left(replace(gen_random_uuid()::text,'-',''),20),'whatsapp','+5511999990000'));
-- Legacy compatibility: an existing account with no username/phone is still authorized.
-- These are synthetic rows only; do not change existing accounts.
-- Transaction-local trigger bypass solely to INSERT a new pre-trigger fixture.
set local session_replication_role = replica;
insert into auth.users(id,email) values ('81000000-0000-4000-8000-000000000003','reading-legacy@example.invalid');
set local session_replication_role = origin;
insert into public.profiles(id) values ('81000000-0000-4000-8000-000000000003');
insert into public.devotionals(id,title,bible_reference,bible_text,content,reflection_question,status,publish_at,author_id)
select id::uuid,'Devocional SQL fictício','Ref fictícia','Texto fictício','Conteúdo fictício','Pergunta?',status,at,
'81000000-0000-4000-8000-000000000001'::uuid from (values
('82000000-0000-4000-8000-000000000001','published',now()-interval '1 day'),
('82000000-0000-4000-8000-000000000002','published',now()-interval '1 day'),
('82000000-0000-4000-8000-000000000003','draft',null::timestamptz),
('82000000-0000-4000-8000-000000000004','scheduled',now()-interval '1 day'),
('82000000-0000-4000-8000-000000000005','published',now()+interval '1 day')) t(id,status,at);

select pg_temp.ok((select count(*)=3 and bool_and(relrowsecurity) from pg_class where oid in
('public.reading_progress'::regclass,'private.reading_leases'::regclass,'public.devotional_completions'::regclass)), 'new records have RLS');
select pg_temp.ok((select not rolcanlogin and not rolbypassrls and not rolsuper from pg_roles where rolname='selah_reading_owner'), 'technical role has no login or bypass');
select pg_temp.ok(not pg_has_role('authenticated','selah_reading_owner','MEMBER') and not pg_has_role('anon','selah_reading_owner','MEMBER'), 'API cannot assume technical role');
select pg_temp.ok(not has_schema_privilege('selah_reading_owner','public','CREATE') and not has_schema_privilege('selah_reading_owner','private','CREATE'), 'temporary DDL privileges removed');
select pg_temp.ok(not has_table_privilege('selah_reading_owner','public.profiles','SELECT') and not has_table_privilege('selah_reading_owner','auth.users','SELECT'), 'protocol cannot read private profile or Auth data');
select pg_temp.ok((select bool_and(prosecdef and proconfig @> array['search_path=""'] and pg_get_userbyid(proowner)='selah_reading_owner') from pg_proc where oid in
('public.get_my_reading_state(uuid)'::regprocedure,'public.start_reading(uuid,uuid,bigint)'::regprocedure,'public.take_over_reading(uuid,uuid,bigint)'::regprocedure,
'public.checkpoint_reading(uuid,uuid,uuid,bigint)'::regprocedure,'public.pause_reading(uuid,uuid,uuid)'::regprocedure,'public.complete_devotional(uuid)'::regprocedure)), 'RPC owners and search_path hardened');
select pg_temp.ok(not has_function_privilege('authenticated','private.reading_operation(uuid,text,uuid,bigint,uuid,bigint)','EXECUTE'), 'internal dispatcher not callable');
select pg_temp.ok(not has_function_privilege('authenticated','private.reading_identity()','EXECUTE') and not has_function_privilege('service_role','private.reading_identity()','EXECUTE'), 'identity helper has no API grants');
select pg_temp.ok((select prosecdef and proconfig @> array['search_path=""'] and pg_get_userbyid(proowner)='postgres' from pg_proc where oid='private.reading_identity()'::regprocedure), 'identity-only helper hardened');
select pg_temp.ok(not has_table_privilege('service_role','public.reading_progress','SELECT') and not has_table_privilege('service_role','public.devotional_completions','INSERT'), 'no unnecessary service API grants');
set local role anon;
select pg_temp.denied('select * from public.reading_progress');
select pg_temp.denied('select * from public.devotional_completions');
select pg_temp.denied($q$select public.get_my_reading_state('82000000-0000-4000-8000-000000000001')$q$);
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"83000000-0000-4000-8000-000000000001"}',true);
select pg_temp.denied('select * from private.reading_leases');
select pg_temp.denied('select private.reading_identity()');
select pg_temp.denied($q$insert into public.reading_progress(user_id,devotional_id,revision,credited_ms) values ('81000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001',1,60000)$q$);
select pg_temp.denied('update public.reading_progress set credited_ms=60000');
select pg_temp.denied('delete from public.reading_progress');
select pg_temp.denied($q$insert into public.devotional_completions(user_id,source_devotional_id,revision,completed_at,completed_day) values ('81000000-0000-4000-8000-000000000001',gen_random_uuid(),1,now(),current_date)$q$);
select pg_temp.denied('update public.devotional_completions set completed_at=now()');
select pg_temp.denied('delete from public.devotional_completions');
select pg_temp.ok(public.get_my_reading_state('82000000-0000-4000-8000-000000000001')->>'credited_ms'='0','opening does not supply time');
select pg_temp.ok(public.complete_devotional('82000000-0000-4000-8000-000000000001')->>'status'='too_early','premature completion denied');
select pg_temp.ok(public.get_my_reading_state('82000000-0000-4000-8000-000000000003')->>'status'='unavailable','draft denied');
select pg_temp.ok(public.start_reading('82000000-0000-4000-8000-000000000004',gen_random_uuid(),1)->>'status'='unavailable','scheduled denied');
select pg_temp.ok(public.complete_devotional('82000000-0000-4000-8000-000000000005')->>'status'='unavailable','future publication denied');
update reading_result set value=public.start_reading('82000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001',1);
select pg_temp.ok((select value->>'status'='active' and value->>'sequence'='0' and value->>'token' is not null from reading_result),'lease starts with server nonce');
select pg_temp.ok(public.start_reading('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000002',1)->>'status'='elsewhere','only one text/reading per account');
select pg_temp.ok(public.checkpoint_reading('82000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001',(select (value->>'token')::uuid from reading_result),2)->>'status'='out_of_order','future sequence refused');
reset role;
update private.reading_leases set last_checkpoint_at=clock_timestamp()-interval '5 seconds',expires_at=clock_timestamp()+interval '15 seconds' where user_id='81000000-0000-4000-8000-000000000001';
set local role authenticated;
update reading_result set value=public.checkpoint_reading('82000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001',(select (value->>'token')::uuid from reading_result),1);
select pg_temp.ok((select (value->>'credited_ms')::int between 5000 and 9999 from reading_result),'server interval credited');
select pg_temp.ok(public.checkpoint_reading('82000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001',(select (value->>'token')::uuid from reading_result),1)->>'credited_ms'=(select value->>'credited_ms' from reading_result),'same checkpoint idempotent');
reset role;
update private.reading_leases set last_checkpoint_at=clock_timestamp()-interval '1 hour' where user_id='81000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.ok(public.checkpoint_reading('82000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001',(select (value->>'token')::uuid from reading_result),2)->>'credited_ms'=(select value->>'credited_ms' from reading_result),'long gap receives no capped/free time');
reset role;
update private.reading_leases set last_checkpoint_at=clock_timestamp()+interval '1 hour' where user_id='81000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.ok(public.checkpoint_reading('82000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001',(select (value->>'token')::uuid from reading_result),3)->>'credited_ms'=(select value->>'credited_ms' from reading_result),'negative server interval receives no time');
select pg_temp.ok(public.pause_reading('82000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001',(select (value->>'token')::uuid from reading_result))->>'status'='paused','pause discards tail');
select pg_temp.ok(public.checkpoint_reading('82000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001',(select (value->>'token')::uuid from reading_result),4)->>'status'='paused','paused token cannot credit');
update reading_result set value=public.start_reading('82000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001',1);
select pg_temp.ok(public.take_over_reading('82000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000002',1)->>'status'='active','explicit transfer admitted');
select pg_temp.ok(public.checkpoint_reading('82000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001',(select (value->>'token')::uuid from reading_result),1)->>'status'='elsewhere','old generation invalid after transfer');
reset role;
update public.devotionals set content='Conteúdo fictício revisado' where id='82000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.ok(public.get_my_reading_state('82000000-0000-4000-8000-000000000002')->>'revision_changed'='true','editorial change reported');
select pg_temp.ok(public.get_my_reading_state('82000000-0000-4000-8000-000000000002')->>'credited_ms'='0','only incomplete old progress resets');
select pg_temp.ok(public.start_reading('82000000-0000-4000-8000-000000000002',gen_random_uuid(),1)->>'status'='revision_changed','old displayed revision cannot accrue');
reset role;
update public.reading_progress set credited_ms=59999 where user_id='81000000-0000-4000-8000-000000000001' and devotional_id='82000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.ok(public.complete_devotional('82000000-0000-4000-8000-000000000001')->>'status'='too_early','59999 ms denied');
select pg_temp.ok((select count(*)=0 from public.devotional_completions),'no automatic completion');
reset role;
update public.reading_progress set credited_ms=60000 where user_id='81000000-0000-4000-8000-000000000001' and devotional_id='82000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.ok(public.get_my_reading_state('82000000-0000-4000-8000-000000000001')->>'status'='ready','60000 ms eligible');
select pg_temp.ok((select count(*)=0 from public.devotional_completions),'eligibility still requires voluntary action');
update reading_result set value=public.complete_devotional('82000000-0000-4000-8000-000000000001');
select pg_temp.ok((select value->>'status'='completed' from reading_result),'explicit completion persisted');
select pg_temp.ok(public.complete_devotional('82000000-0000-4000-8000-000000000001')->>'completed_at'=(select value->>'completed_at' from reading_result),'repeat returns original completion');
select pg_temp.ok((select count(*)=1 from public.devotional_completions),'unique user/devotional receipt');
select pg_temp.ok((select completed_day=(completed_at at time zone 'America/Sao_Paulo')::date and completed_at between statement_timestamp()-interval '1 minute' and clock_timestamp() from public.devotional_completions),'server instant and civil day');
insert into public.devotional_views(devotional_id) values ('82000000-0000-4000-8000-000000000001');
reset role;
update public.devotionals set content='Outra edição fictícia',status='draft' where id='82000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.ok(public.complete_devotional('82000000-0000-4000-8000-000000000001')->>'status'='completed','historical completion survives edit and unpublish');
reset role;
-- Delete only this transaction's synthetic content. All effects rollback.
delete from public.devotionals where id='82000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.ok((select devotional_id is null and source_devotional_id='82000000-0000-4000-8000-000000000001' from public.devotional_completions),'deleted content original identity retained without text');
select pg_temp.ok((select count(*)=1 from public.devotional_views where user_id='81000000-0000-4000-8000-000000000001' and devotional_id is null),'existing opening preserved by SET NULL');
select pg_temp.ok(public.complete_devotional('82000000-0000-4000-8000-000000000001')->>'completed_at'=(select value->>'completed_at' from reading_result),'deleted completion replay remains idempotent');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"83000000-0000-4000-8000-000000000002"}',true);
select pg_temp.ok((select count(*)=0 from public.devotional_completions),'other account cannot read receipts');
select pg_temp.ok((select count(*)=0 from public.reading_progress),'other account cannot read progress');
select pg_temp.ok(public.get_my_reading_state('82000000-0000-4000-8000-000000000002')->>'credited_ms'='0','other account has independent time');
select pg_temp.ok(public.complete_devotional('82000000-0000-4000-8000-000000000002')->>'status'='too_early','cannot complete using another account time');
reset role;
insert into private.admin_users(user_id) values ('81000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.ok(not exists(select 1 from public.devotional_open_counts() where devotional_id='82000000-0000-4000-8000-000000000001'),'administrative reports handle orphan openings without restoring deleted content');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"83000000-0000-4000-8000-000000000003"}',true);
select pg_temp.ok(public.start_reading('82000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000003',2)->>'status'='active','legacy account without username or phone can read');
reset role;
select pg_temp.ok((select count(*)=0 from private.reading_leases where user_id='81000000-0000-4000-8000-000000000001' and token is not null),'revision invalidates old lease');
select count(*) as reading_sql_checks from reading_checks \gset
rollback;
\echo :reading_sql_checks reading SQL checks passed; ROLLBACK complete.
