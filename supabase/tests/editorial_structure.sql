\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(v boolean, label text) returns void language plpgsql as $$ begin if not coalesce(v,false) then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.denied(q text, expected text, label text) returns void language plpgsql as $$ declare actual text; begin begin execute q; exception when others then get stacked diagnostics actual=returned_sqlstate; if actual<>expected then raise exception 'FAIL: % expected SQLSTATE %, got %',label,expected,actual; end if; raise notice 'PASS: % (SQLSTATE %)',label,actual; return; end; raise exception 'FAIL: % succeeded',label; end $$;
set local session_replication_role=replica;
insert into auth.users(id,email_confirmed_at) values ('10000000-0000-4000-8000-000000000001',now()),('10000000-0000-4000-8000-000000000002',now()),('10000000-0000-4000-8000-000000000003',now());
set local session_replication_role=origin;
insert into private.app_owner(user_id) values('10000000-0000-4000-8000-000000000001');
insert into public.devotionals(id,title,bible_reference,bible_text,content,reflection_question,status,publish_at,author_id) values
('20000000-0000-4000-8000-000000000001','Visible one','Ref','Text','Content','Question','published',now()-interval '1 day','10000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000002','Hidden draft','Ref','Text','Content','Question','draft',null,'10000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000003','Visible today','Ref','Text','Content','Question','published',now()-interval '1 minute','10000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000004','Hidden scheduled','Ref','Text','Content','Question','scheduled',now()+interval '1 day','10000000-0000-4000-8000-000000000001');
insert into private.editorial_themes(id,name,normalized_name,slug) values ('30000000-0000-4000-8000-000000000001','  Fé   Viva  ','','fe-viva'),('30000000-0000-4000-8000-000000000002','Hidden theme','','hidden-theme');
insert into private.editorial_series(id,title,slug,available) values ('40000000-0000-4000-8000-000000000001','Series','series',true),('40000000-0000-4000-8000-000000000002','Hidden series','hidden-series',true),('40000000-0000-4000-8000-000000000003','Unavailable series','unavailable-series',false);
insert into private.editorial_devotional_themes values ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'),('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002');
insert into private.editorial_episodes values
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1),
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',2),
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003',3),
('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004',1);
select pg_temp.ok((select normalized_name='fe viva' from private.editorial_themes where slug='fe-viva'),'name normalization');
select pg_temp.denied($q$insert into private.editorial_themes(name,normalized_name,slug) values('FE viva','','other')$q$,'23505','normalized uniqueness');
select pg_temp.denied($q$update private.editorial_themes set slug='changed' where slug='fe-viva'$q$,'23514','immutable theme slug');
select pg_temp.denied($q$update private.editorial_series set slug='changed' where slug='series'$q$,'23514','immutable series slug');
select pg_temp.denied($q$delete from private.editorial_themes where slug='fe-viva'$q$,'23503','theme delete restrict');
select pg_temp.denied($q$delete from private.editorial_series where slug='series'$q$,'23503','series delete restrict');
select pg_temp.denied($q$insert into private.editorial_episodes values ('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001',1)$q$,'23505','one series per devotional');
select pg_temp.denied($q$update private.editorial_episodes set position=0 where devotional_id='20000000-0000-4000-8000-000000000001'$q$,'23514','positive position');
select pg_temp.ok(not has_table_privilege('authenticated','private.editorial_themes','SELECT,INSERT,UPDATE,DELETE'),'private table privileges');
select pg_temp.ok(not has_function_privilege('anon','public.reader_editorial_catalog(text,text,integer,integer)','EXECUTE'),'anon execute denied');
select pg_temp.ok(not has_function_privilege('authenticated','private.editorial_owner_lock()','EXECUTE'),'internal lock execute denied');
set local role anon;
select pg_temp.denied($q$select public.reader_editorial_catalog('themes',null,0,25)$q$,'42501','anon direct catalog denied');
select pg_temp.denied($q$select public.owner_editorial_change('create_theme','{"name":"No","slug":"no"}')$q$,'42501','anon direct mutation denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select pg_temp.denied($q$select public.owner_editorial_change('create_theme','{"name":"No","slug":"no"}')$q$,'42501','reader denied owner mutation');
select pg_temp.denied($q$select * from private.editorial_themes$q$,'42501','reader direct access denied');
select pg_temp.ok(jsonb_array_length(public.reader_editorial_catalog('themes',null,0,25))=1,'hidden themes excluded');
select pg_temp.ok(jsonb_array_length(public.reader_editorial_catalog('series',null,0,25))=1,'hidden and unavailable series excluded');
select pg_temp.ok(jsonb_array_length(public.reader_editorial_catalog('episodes','series',0,25))=2,'only released episodes returned');
select pg_temp.ok(position('Hidden' in public.reader_editorial_catalog('episodes','series',0,25)::text)=0,'draft titles excluded');
select pg_temp.ok(position('position' in public.reader_editorial_catalog('episodes','series',0,25)::text)=0,'internal positions excluded');
select pg_temp.ok(jsonb_array_length(public.reader_editorial_catalog('devotionals',null,0,25))=2,'today and earlier available');
select pg_temp.ok(jsonb_array_length(public.reader_editorial_catalog('episodes','series',0,1))=1,'bounded pagination');
select pg_temp.denied($q$select public.reader_editorial_catalog('series',null,0,101)$q$,'22023','page limit enforced');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select pg_temp.denied($q$select public.owner_editorial_change('delete_series','{"id":"40000000-0000-4000-8000-000000000001"}')$q$,'42501','second nonowner denied');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select pg_temp.ok((public.owner_editorial_change('create_theme','{"name":"Esperanca","slug":"esperanca"}')->>'id')::uuid is not null,'owner creates theme');
select pg_temp.ok((public.owner_editorial_change('create_series','{"title":"Private fixture","slug":"private-fixture","responsible_user_id":"10000000-0000-4000-8000-000000000002"}')->>'id')::uuid is not null,'owner creates series with responsible');
select pg_temp.ok(public.reader_editorial_catalog('series_detail','hidden-series',0,25)='null'::jsonb,'unavailable series detail hidden');
select pg_temp.ok(position('responsible' in public.reader_editorial_catalog('series_detail','series',0,25)::text)=0,'responsible not exposed');
select pg_temp.ok(public.owner_editorial_change('reorder_series','{"series_id":"40000000-0000-4000-8000-000000000001","devotional_ids":["20000000-0000-4000-8000-000000000003","20000000-0000-4000-8000-000000000002","20000000-0000-4000-8000-000000000001"]}') is not null,'owner reorder');
select pg_temp.ok(public.reader_editorial_catalog('episodes','series',0,25)->0->>'title'='Visible today','visible ordering after reorder');
select pg_temp.denied($q$select public.owner_editorial_change('update_theme','{"id":"30000000-0000-4000-8000-000000000001","name":"x","slug":"stolen"}')$q$,'22023','protected slug rejected');
reset role;
select pg_temp.ok((select reading_revision=1 from public.devotionals where id='20000000-0000-4000-8000-000000000001'),'editorial changes preserve reading revision');
update auth.users set banned_until=now()+interval '1 day' where id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.denied($q$select public.owner_editorial_change('create_theme','{"name":"No","slug":"no"}')$q$,'42501','suspended owner denied');
reset role;
update auth.users set banned_until=null where id='10000000-0000-4000-8000-000000000001';
insert into public.account_deletion_requests(user_id) values ('10000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.denied($q$select public.owner_editorial_change('create_theme','{"name":"No","slug":"no"}')$q$,'42501','deletion pending owner denied');
reset role;
delete from public.account_deletion_requests where user_id='10000000-0000-4000-8000-000000000001';
update auth.users set email_confirmed_at=null where id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.denied($q$select public.owner_editorial_change('create_theme','{"name":"No","slug":"no"}')$q$,'42501','unconfirmed owner denied');
reset role;
update auth.users set email_confirmed_at=now() where id='10000000-0000-4000-8000-000000000001';
delete from private.app_owner where user_id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.denied($q$select public.owner_editorial_change('create_theme','{"name":"No","slug":"no"}')$q$,'42501','revoked owner denied');
reset role;
select pg_temp.ok(not exists(select 1 from private.editorial_themes where slug in ('no','changed')),'denied writes have no side effects');
select pg_temp.ok((select count(*)=3 from private.editorial_episodes where series_id='40000000-0000-4000-8000-000000000001'),'denied operations preserve episodes');
rollback;
