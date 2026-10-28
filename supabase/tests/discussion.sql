-- Only synthetic fixtures, intended for the NEW isolated PostgreSQL runner.
\set ON_ERROR_STOP on
begin;
create temp table discussion_checks(label text);
grant insert on discussion_checks to authenticated,anon;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$begin
  if value is distinct from true then raise exception 'FAIL: %',label;end if;
  insert into pg_temp.discussion_checks values(label);end $$;
create function pg_temp.rejected(statement text,code text) returns void language plpgsql as $$begin
  begin execute statement;exception when others then if sqlstate=code then insert into pg_temp.discussion_checks values('rejected '||code);return;end if;raise;end;
  raise exception 'FAIL: expected rejection';end $$;
create temp table discussion_fixture(name text,id uuid);
insert into discussion_fixture select name,gen_random_uuid() from unnest(array['owner','reader','other','publisher']) name;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  select id,'discussion-'||id||'@example.invalid',now(),jsonb_build_object('username','dc_'||name,'whatsapp','+5511999990000') from discussion_fixture;
insert into private.app_owner(user_id) select id from discussion_fixture where name='owner';
insert into private.admin_users(user_id) select id from discussion_fixture where name in ('owner','publisher');
create temp table discussion_content(id uuid,draft uuid);
grant select on discussion_content to authenticated;
insert into discussion_content values(gen_random_uuid(),gen_random_uuid());
insert into public.devotionals(id,title,bible_reference,bible_text,content,reflection_question,publish_at,status,author_id)
 select c.id,'Publicacao ficticia','Ref','Texto','Reflexao','Pergunta?',now()-interval '1 hour','published',f.id from discussion_content c cross join discussion_fixture f where f.name='publisher'
 union all select c.draft,'Rascunho ficticio','Ref','Texto','Reflexao','Pergunta?',now(),'draft',f.id from discussion_content c cross join discussion_fixture f where f.name='publisher';
create function pg_temp.who(name text) returns void language sql as $$ select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from pg_temp.discussion_fixture where discussion_fixture.name=$1),'role','authenticated')::text,true)::text::void $$;
create function pg_temp.content() returns uuid language sql as $$select id from pg_temp.discussion_content$$;
create function pg_temp.comment_id() returns uuid language sql as $$select id from private.discussion_comments where devotional_id=pg_temp.content() and user_id=(select id from pg_temp.discussion_fixture where name='reader')$$;
create function pg_temp.version() returns integer language sql as $$select version from private.discussion_comments where id=pg_temp.comment_id()$$;

select pg_temp.ok((select count(*)=5 and bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('discussion_comments','discussion_reactions','discussion_reports','discussion_audit','discussion_limits')),'all discussion tables have RLS');
select pg_temp.ok(not has_table_privilege('authenticated','private.discussion_comments','SELECT,INSERT,UPDATE,DELETE'),'API cannot bypass projections');
select pg_temp.ok(not has_table_privilege('service_role','private.discussion_reports','SELECT'),'service API cannot read reports');
select pg_temp.ok(not has_function_privilege('anon','public.get_devotional_discussion(uuid,integer)','EXECUTE'),'anonymous cannot query');
select pg_temp.ok(not has_function_privilege('authenticated','private.cleanup_discussion(timestamptz)','EXECUTE'),'reader cannot run cleanup');
set local role anon;
select pg_temp.rejected('select public.get_devotional_discussion(gen_random_uuid())','42501');
reset role;
select pg_temp.who('reader');
select pg_temp.ok(public.get_my_discussion_access()=false,'reader is not Owner');
select pg_temp.ok(public.get_devotional_discussion(pg_temp.content())->'comments'='[]'::jsonb,'empty approved list');
set local role authenticated;
select pg_temp.ok(public.get_devotional_discussion(pg_temp.content())->'reaction'='null'::jsonb,'authenticated role can use own projection without raw table grants');
reset role;
select public.set_my_devotional_reaction(pg_temp.content(),'like');
select pg_temp.ok(public.get_devotional_discussion(pg_temp.content())->>'reaction'='like','like saved');
select public.set_my_devotional_reaction(pg_temp.content(),'like');
select pg_temp.ok((select count(*)=1 from private.discussion_reactions),'reaction retry does not duplicate');
select public.set_my_devotional_reaction(pg_temp.content(),'dislike');
select pg_temp.ok(public.get_devotional_discussion(pg_temp.content())->>'reaction'='dislike','reaction changed');
select public.set_my_devotional_reaction(pg_temp.content(),null);
select pg_temp.ok(public.get_devotional_discussion(pg_temp.content())->'reaction'='null'::jsonb,'reaction removed');
select pg_temp.rejected(format('select public.set_my_devotional_reaction(%L,%L)',pg_temp.content(),'OWNER'),'22023');
select pg_temp.rejected(format('select public.set_my_devotional_reaction(%L,%L)',draft,'like'),'42501') from discussion_content;
select pg_temp.rejected(format('select public.save_my_devotional_comment(%L,%L)',draft,'hidden'),'42501') from discussion_content;
select pg_temp.rejected(format('select public.save_my_devotional_comment(%L,%L)',pg_temp.content(),repeat('a',1001)),'22023');
select pg_temp.rejected(format('select public.save_my_devotional_comment(%L,%L)',pg_temp.content(),'   '),'22023');
select public.save_my_devotional_comment(pg_temp.content(),'<script>alert("fiction")</script>',0);
select pg_temp.ok((public.get_devotional_discussion(pg_temp.content())->'own'->>'state')='pending','new reflection pending');
select pg_temp.ok((public.get_devotional_discussion(pg_temp.content())->'own'->>'body')='<script>alert("fiction")</script>','HTML kept as plain text for escaped rendering');
select public.save_my_devotional_comment(pg_temp.content(),'<script>alert("fiction")</script>',0);
select pg_temp.ok(pg_temp.version()=1,'lost response retry preserves version and one principal comment');
select pg_temp.ok((select count(*)=1 from private.discussion_comments),'one principal comment');
select pg_temp.who('other');
select pg_temp.ok(public.get_devotional_discussion(pg_temp.content())->'own'='null'::jsonb and jsonb_array_length(public.get_devotional_discussion(pg_temp.content())->'comments')=0,'third party sees neither body nor pending comment');
select pg_temp.rejected(format('select public.moderate_devotional_comment(%L,1,%L,%L)',pg_temp.comment_id(),'approve','reviewed'),'42501');
select pg_temp.who('publisher');
select pg_temp.ok(not public.get_my_discussion_access(),'editorial does not inherit Owner');
select pg_temp.rejected('select public.get_owner_discussion()','42501');
select pg_temp.rejected(format('select public.moderate_devotional_comment(%L,1,%L,%L)',pg_temp.comment_id(),'approve','reviewed'),'42501');
select pg_temp.who('owner');
select pg_temp.ok(public.get_my_discussion_access(),'existing Owner allowed');
select pg_temp.ok(public.get_owner_discussion()->>'total'='1','Owner sees pending queue');
select public.moderate_devotional_comment(pg_temp.comment_id(),pg_temp.version(),'approve','reviewed');
select pg_temp.ok((select state='approved' from private.discussion_comments where id=pg_temp.comment_id()),'Owner approval');
select pg_temp.who('other');
select pg_temp.ok(jsonb_array_length(public.get_devotional_discussion(pg_temp.content())->'comments')=1,'approved visible to authenticated readers');
select pg_temp.ok(not (public.get_devotional_discussion(pg_temp.content())->'comments')::text ~ 'user_id|email|phone|reporter|actor_id','public projection has no author private identifiers');
select public.report_devotional_comment(pg_temp.comment_id(),'contact');
select public.report_devotional_comment(pg_temp.comment_id(),'contact');
select pg_temp.ok((select count(*)=1 from private.discussion_reports),'duplicate report retry is idempotent');
-- Exercise server-wide reporting cap on another approved synthetic reflection.
insert into private.discussion_limits(user_id,kind,bucket,uses)
 select id,'report',to_timestamp(floor(extract(epoch from clock_timestamp())/86400)*86400),5 from discussion_fixture where name='other'
 on conflict(user_id,kind,bucket) do update set uses=5;
insert into private.discussion_comments(devotional_id,user_id,body,state)
 select pg_temp.content(),id,'Second fictional reflection','approved' from discussion_fixture where name='publisher';
select pg_temp.rejected(format('select public.report_devotional_comment(%L,%L)',(select id from private.discussion_comments where user_id=(select id from discussion_fixture where name='publisher')),'spam'),'P0429');
select public.report_devotional_comment(pg_temp.comment_id(),'contact');
select pg_temp.ok((select count(*)=1 from private.discussion_reports),'duplicate retry does not consume extra report quota');
update private.discussion_comments set body='',state='removed' where user_id=(select id from discussion_fixture where name='publisher');
select pg_temp.who('reader');
select pg_temp.rejected(format('select public.report_devotional_comment(%L,%L)',pg_temp.comment_id(),'spam'),'42501');
select public.save_my_devotional_comment(pg_temp.content(),'Edited fictional reflection',pg_temp.version());
select pg_temp.ok((select state='pending' and body='Edited fictional reflection' from private.discussion_comments where id=pg_temp.comment_id()),'approved edit returns to pending');
select pg_temp.who('other');
select pg_temp.ok(jsonb_array_length(public.get_devotional_discussion(pg_temp.content())->'comments')=0,'edited unreviewed text not public');
select pg_temp.who('owner');
select pg_temp.rejected(format('select public.moderate_devotional_comment(%L,2,%L,%L)',pg_temp.comment_id(),'approve','reviewed'),'40001');
select public.moderate_devotional_comment(pg_temp.comment_id(),pg_temp.version(),'reject','contact');
select pg_temp.ok((select state='rejected' from private.discussion_comments where id=pg_temp.comment_id()),'reject pending');
select public.moderate_devotional_comment(pg_temp.comment_id(),pg_temp.version(),'approve','reviewed');
select public.moderate_devotional_comment(pg_temp.comment_id(),pg_temp.version(),'hide','harassment');
select pg_temp.ok((select state='hidden' from private.discussion_comments where id=pg_temp.comment_id()),'hide approved');
select pg_temp.ok((public.get_owner_discussion('history')->>'total')::integer>=6,'minimal action history');
select pg_temp.who('reader');
select pg_temp.ok(public.get_devotional_discussion(pg_temp.content())->'own'->>'state'='hidden','author sees own hidden status');
select public.remove_my_devotional_comment(pg_temp.content(),pg_temp.version());
select pg_temp.ok((select state='removed' and body='' from private.discussion_comments where id=pg_temp.comment_id()),'own erasure clears text');
select public.remove_my_devotional_comment(pg_temp.content(),pg_temp.version());
select pg_temp.ok((select count(*)=1 from private.discussion_comments where user_id=(select id from discussion_fixture where name='reader')),'repeat delete retains uniqueness tombstone');
-- Four more edits reach five comment writes in the hour; sixth is rejected.
select public.save_my_devotional_comment(pg_temp.content(),'Again one',pg_temp.version());
select public.save_my_devotional_comment(pg_temp.content(),'Again two',pg_temp.version());
select public.save_my_devotional_comment(pg_temp.content(),'Again three',pg_temp.version());
select pg_temp.rejected(format('select public.save_my_devotional_comment(%L,%L,%s)',pg_temp.content(),'Too many',pg_temp.version()),'P0429');
select pg_temp.ok((select body='Again three' from private.discussion_comments where id=pg_temp.comment_id()),'rate rejection preserves last body');
select pg_temp.who('other');
select public.remove_my_devotional_comment(pg_temp.content(),0);
select pg_temp.ok((select body='Again three' from private.discussion_comments where id=pg_temp.comment_id()),'other account cannot erase author text');
select public.save_my_devotional_comment(pg_temp.content(),repeat('x',1000),0);
select pg_temp.ok(length(public.get_devotional_discussion(pg_temp.content())->'own'->>'body')=1000,'server accepts exact 1000 character bound');
insert into private.discussion_limits(user_id,kind,bucket,uses)
 select id,'reaction',to_timestamp(floor(extract(epoch from clock_timestamp())/3600)*3600),60 from discussion_fixture where name='other';
select pg_temp.rejected(format('select public.set_my_devotional_reaction(%L,%L)',pg_temp.content(),'like'),'P0429');
set local role authenticated;
select pg_temp.rejected('select * from private.discussion_comments','42501');
select pg_temp.rejected('select * from private.discussion_reactions','42501');
select pg_temp.rejected('select * from private.discussion_reports','42501');
reset role;
select pg_temp.who('owner');
set local role authenticated;
select pg_temp.rejected('select * from private.discussion_comments','42501');
reset role;
update private.discussion_comments set updated_at=clock_timestamp()-interval '31 days' where id=pg_temp.comment_id();
select private.cleanup_discussion();
select pg_temp.ok((select body='' and state='removed' from private.discussion_comments where id=pg_temp.comment_id()),'retention erases old unapproved text');
select count(*) || ' discussion SQL checks passed' from discussion_checks;
rollback;
