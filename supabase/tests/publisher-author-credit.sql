-- IMPORTANT: run only on a disposable LOCAL Supabase database with migrations applied.
-- This test uses synthetic accounts, makes no network calls and rolls back all data.
\set ON_ERROR_STOP on
begin;

create function pg_temp.ok(value boolean, label text) returns void
language plpgsql as $$ begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;
create function pg_temp.affected(statement text, expected bigint, label text) returns void
language plpgsql as $
declare actual bigint;
begin
  execute statement;
  get diagnostics actual = row_count;
  if actual <> expected then raise exception 'FAIL: % expected %, got %', label, expected, actual; end if;
end $;
create function pg_temp.denied(statement text, label text) returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception when sqlstate '42501' then return;
  end;
  raise exception 'FAIL: expected denial: %', label;
end $$;

create temp table publisher_test_ids(role text primary key, user_id uuid not null, username text not null);
grant select on publisher_test_ids to authenticated;
insert into publisher_test_ids(role,user_id,username) values
  ('owner',gen_random_uuid(),'owner_' || left(replace(gen_random_uuid()::text,'-',''),12)),
  ('admin',gen_random_uuid(),'admin_' || left(replace(gen_random_uuid()::text,'-',''),12)),
  ('publisher',gen_random_uuid(),'writer_' || left(replace(gen_random_uuid()::text,'-',''),12)),
  ('reader',gen_random_uuid(),'reader_' || left(replace(gen_random_uuid()::text,'-',''),12));

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  select user_id,role||'-'||user_id||'@example.invalid',clock_timestamp(),
    jsonb_build_object('username',username,'whatsapp','+5511999990000')
  from publisher_test_ids;

insert into private.app_owner(user_id)
  select user_id from publisher_test_ids where role='owner';
insert into private.admin_users(user_id)
  select user_id from publisher_test_ids where role='admin';

-- No ordinary reader may create or publish.
select set_config('request.jwt.claims', jsonb_build_object('sub',
  (select user_id from publisher_test_ids where role='reader'), 'role','authenticated')::text, true);
set local role authenticated;
select pg_temp.ok(public.get_my_publisher_access() = false, 'reader is not publisher');
select pg_temp.denied('select public.owner_list_publishers()', 'reader cannot list publishers');
select pg_temp.denied('select public.owner_manage_publisher(''someone'',true)', 'reader cannot grant role');
reset role;

-- Only OWNER grants the role; ADMIN stays unable to manage it.
select set_config('request.jwt.claims', jsonb_build_object('sub',
  (select user_id from publisher_test_ids where role='admin'), 'role','authenticated')::text, true);
set local role authenticated;
select pg_temp.denied('select public.owner_list_publishers()', 'ADMIN cannot list publishers');
select pg_temp.denied('select public.owner_manage_publisher(''someone'',true)', 'ADMIN cannot grant role');
reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub',
  (select user_id from publisher_test_ids where role='owner'), 'role','authenticated')::text, true);
set local role authenticated;
select public.owner_manage_publisher((select username from publisher_test_ids where role='publisher'),true);
select pg_temp.ok(jsonb_array_length(public.owner_list_publishers())=1, 'OWNER can list its publisher membership');
reset role;

create temp table publisher_test_devotional(id uuid primary key);
grant select on publisher_test_devotional to authenticated;

-- The publisher can insert and edit only their draft and may not publish.
select set_config('request.jwt.claims', jsonb_build_object('sub',
  (select user_id from publisher_test_ids where role='publisher'), 'role','authenticated')::text, true);
set local role authenticated;
select pg_temp.ok(public.get_my_publisher_access() = true, 'publisher membership is active');
insert into public.devotionals(author_id,author_name,title,bible_reference,bible_text,content,reflection_question)
values ((select user_id from publisher_test_ids where role='publisher'),
  'Autora Convidada','Rascunho sintético','Salmos 46:10','Texto fictício',
  'Reflexão fictícia','Pergunta fictícia?');
select pg_temp.ok((select count(*)=1 from public.devotionals where title='Rascunho sintético'), 'publisher sees own draft');
select pg_temp.denied($q$insert into public.devotionals(author_id,author_name,title,bible_reference,bible_text,content,reflection_question,status,publish_at)
 values (auth.uid(),'Autor','Tentativa','Salmo','Texto','Conteúdo','Pergunta','published',now())$q$, 'cannot publish directly');
select pg_temp.affected($q$delete from public.devotionals where title='Rascunho sintético'$q$, 0, 'cannot delete content');
update public.devotionals set content='Revisão sintética' where title='Rascunho sintético';
select public.submit_devotional_for_review((select id from public.devotionals where title='Rascunho sintético'));
select pg_temp.ok((select count(*)=1 from public.devotionals where title='Rascunho sintético'
 and review_requested_at is not null and status='draft'), 'submitted draft stays private');
select pg_temp.affected($q$update public.devotionals set content='Tentativa após envio'
 where title='Rascunho sintético'$q$, 0, 'submitted draft is no longer editable');
reset role;

-- Admin can review, but cannot manage publisher roles.
select set_config('request.jwt.claims', jsonb_build_object('sub',
  (select user_id from publisher_test_ids where role='admin'), 'role','authenticated')::text, true);
set local role authenticated;
select pg_temp.ok((select count(*)=1 from public.devotionals where title='Rascunho sintético'
 and review_requested_at is not null), 'ADMIN can see review queue');
update public.devotionals set status='published',publish_at=clock_timestamp()
 where title='Rascunho sintético';
select pg_temp.ok((select author_name='Autora Convidada' from public.devotionals
 where title='Rascunho sintético'), 'credited name survives publication');
reset role;

-- A non-publisher reader can see only the newly published title, not role data.
select set_config('request.jwt.claims', jsonb_build_object('sub',
  (select user_id from publisher_test_ids where role='reader'), 'role','authenticated')::text, true);
set local role authenticated;
select pg_temp.ok((select count(*)=1 from public.devotionals where title='Rascunho sintético'
 and author_name='Autora Convidada'), 'readers see attributed publication');
select pg_temp.denied('select * from private.devotional_publishers', 'private membership inaccessible');
reset role;

rollback;
select 'Publisher/attribution checks passed; all fixtures rolled back.' as result;
