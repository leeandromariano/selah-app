-- Local test data only. Execute after the migration in an isolated local database.
-- No API text, credentials, or user data are included. All changes roll back.
begin;
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %', label; end if; end; $$;
create function pg_temp.rejects(statement text) returns void language plpgsql as $$
begin
  begin execute statement; exception when insufficient_privilege or check_violation then return; end;
  raise exception 'FAIL: expected rejection';
end; $$;
select pg_temp.assert_true(private.valid_devotional_bible_selection('{"translation":"nvt","book":"genesis","chapter":1,"verse":1,"endVerse":1}'::jsonb), 'valid selection');
select pg_temp.assert_true(not private.valid_devotional_bible_selection('{"translation":"invalid","book":"genesis","chapter":1,"verse":1,"endVerse":1}'::jsonb), 'invalid translation');
select pg_temp.assert_true(not private.valid_devotional_bible_selection('{"translation":"nvt","book":"genesis","chapter":1,"verse":3,"endVerse":2}'::jsonb), 'inverted range');
insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data) values
 ('cc000000-0000-4000-8000-000000000001','selection-admin@example.invalid',now(),jsonb_build_object('whatsapp','+5511999990000','username','sql_' || left(replace(gen_random_uuid()::text,'-',''),20))),
 ('cc000000-0000-4000-8000-000000000003','selection-publisher@example.invalid',now(),jsonb_build_object('whatsapp','+5511999990000','username','sql_' || left(replace(gen_random_uuid()::text,'-',''),20))),
 ('cc000000-0000-4000-8000-000000000004','selection-reader@example.invalid',now(),jsonb_build_object('whatsapp','+5511999990000','username','sql_' || left(replace(gen_random_uuid()::text,'-',''),20)));
insert into private.admin_users(user_id) values ('cc000000-0000-4000-8000-000000000001');
insert into private.devotional_publishers(user_id) values ('cc000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"cc000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
insert into public.devotionals(author_id,author_name,title,bible_reference,bible_text,bible_selection,content,reflection_question,status)
values ('cc000000-0000-4000-8000-000000000003','Autora fictícia','Título fictício','Gênesis 1:1',null,'{"translation":"nvt","book":"genesis","chapter":1,"verse":1,"endVerse":1}'::jsonb,'Conteúdo fictício','Pergunta fictícia','draft');
select pg_temp.assert_true((select count(*)=1 from public.devotionals where author_id='cc000000-0000-4000-8000-000000000003'),'publisher saved draft');
select public.submit_devotional_for_review((select id from public.devotionals where author_id='cc000000-0000-4000-8000-000000000003'));
select pg_temp.assert_true((select review_requested_at is not null from public.devotionals where author_id='cc000000-0000-4000-8000-000000000003'),'publisher submitted draft');
select set_config('request.jwt.claims','{"sub":"cc000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select pg_temp.rejects($q$insert into public.devotionals(author_id,author_name,title,bible_reference,bible_text,bible_selection,content,reflection_question,status) values ('cc000000-0000-4000-8000-000000000004','Leitor fictício','Título','Gênesis 1:1',null,'{"translation":"nvt","book":"genesis","chapter":1,"verse":1,"endVerse":1}'::jsonb,'Texto','Pergunta','draft')$q$);
select pg_temp.assert_true((select count(*)=0 from public.devotionals where author_id='cc000000-0000-4000-8000-000000000003'),'reader cannot see draft');
reset role;
rollback;
