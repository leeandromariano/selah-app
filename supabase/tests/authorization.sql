-- Run ONLY against a disposable local Supabase database after the migration.
-- psql -X -v ON_ERROR_STOP=1 -f supabase/tests/authorization.sql <LOCAL_CONNECTION>
-- Fixtures are synthetic adults; all changes are rolled back, including on error.
\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(ok boolean, label text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
end;
$$;
create function pg_temp.denied(statement text) returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege then return;
  end;
  raise exception 'FAIL: expected permission denial: %', statement;
end;
$$;
create function pg_temp.affected(statement text, expected bigint) returns void
language plpgsql as $$
declare actual bigint;
begin
  execute statement;
  get diagnostics actual = row_count;
  if actual <> expected then raise exception 'FAIL: expected % rows, got %', expected, actual; end if;
end;
$$;

-- Auth fixtures have no passwords and cannot be used to sign in.
insert into auth.users (id, email) values
 ('10000000-0000-4000-8000-000000000001', 'reader-one@example.invalid'),
 ('10000000-0000-4000-8000-000000000002', 'reader-two@example.invalid'),
 ('10000000-0000-4000-8000-000000000003', 'admin@example.invalid');
insert into private.admin_users (user_id) values ('10000000-0000-4000-8000-000000000003');
insert into public.profiles (id, name, age_range) values
 ('10000000-0000-4000-8000-000000000002', 'Pessoa fictícia dois', '25_34');
insert into public.devotionals (id, title, bible_reference, bible_text, content, reflection_question, publish_at, status, author_id)
select id::uuid, 'Título fictício', 'Referência fictícia', 'Texto fictício', 'Conteúdo fictício', 'Pergunta fictícia?', publish_at, status,
 '10000000-0000-4000-8000-000000000003'::uuid
from (values
 ('20000000-0000-4000-8000-000000000001', now() - interval '1 day', 'published'),
 ('20000000-0000-4000-8000-000000000002', null::timestamptz, 'draft'),
 ('20000000-0000-4000-8000-000000000003', now() + interval '1 day', 'scheduled'),
 ('20000000-0000-4000-8000-000000000004', now() + interval '1 day', 'published')
) as fixture(id, publish_at, status);
insert into public.privacy_notice_versions (id, version, content, published_at) values
 ('30000000-0000-4000-8000-000000000001', 'test-published', 'Aviso fictício para teste.', now() - interval '1 day'),
 ('30000000-0000-4000-8000-000000000002', 'test-future', 'Aviso futuro fictício.', now() + interval '1 day');

-- Every application table must explicitly have RLS enabled.
select pg_temp.assert_true((select count(*) = 6 and bool_and(c.relrowsecurity)
 from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where (n.nspname = 'public' and c.relname in ('profiles', 'devotionals', 'devotional_views',
 'privacy_notice_versions', 'privacy_acknowledgements'))
 or (n.nspname = 'private' and c.relname = 'admin_users')), 'RLS enabled on all six tables');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.denied('select * from public.profiles');
select pg_temp.denied('select * from public.devotionals');
select pg_temp.denied('select * from public.devotional_views');
select pg_temp.denied('select * from public.privacy_acknowledgements');
select pg_temp.denied('select * from private.admin_users');
select pg_temp.denied('select * from public.devotional_open_counts()');
select pg_temp.denied('create table public.unauthorized_anon_object (id integer)');
select pg_temp.denied($q$insert into public.devotional_views (devotional_id) values ('20000000-0000-4000-8000-000000000001')$q$);
select pg_temp.assert_true((select count(*) = 1 from public.privacy_notice_versions
 where id in ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002')), 'anon sees only released notices');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into public.profiles (id, name, age_range) values
 ('10000000-0000-4000-8000-000000000001', 'Pessoa fictícia um', '18_24');
select pg_temp.assert_true((select count(*) = 1 from public.profiles), 'reader sees only own profile');
select pg_temp.affected($q$update public.profiles set name = 'Nome fictício atualizado' where id = '10000000-0000-4000-8000-000000000001'$q$, 1);
select pg_temp.affected($q$update public.profiles set name = 'Tentativa' where id = '10000000-0000-4000-8000-000000000002'$q$, 0);
select pg_temp.denied($q$insert into public.profiles (id, name) values ('10000000-0000-4000-8000-000000000003', 'Tentativa')$q$);
select pg_temp.denied($q$update public.profiles set id = '10000000-0000-4000-8000-000000000003'$q$);
select pg_temp.denied($q$update public.profiles set created_at = now()$q$);
select pg_temp.denied('delete from public.profiles');
select pg_temp.denied($q$insert into private.admin_users (user_id) values ('10000000-0000-4000-8000-000000000001')$q$);
-- Untrusted user metadata must never confer administration.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"role":"admin"}}', true);
select pg_temp.assert_true(not private.is_admin(), 'metadata cannot grant admin');
select pg_temp.denied('create table public.unauthorized_reader_object (id integer)');
select pg_temp.assert_true((select count(*) = 1 from public.devotionals
 where id::text like '20000000-0000-4000-8000-%'), 'reader sees only past published devotional');
select pg_temp.denied($q$insert into public.devotionals (title, bible_reference, bible_text, content, reflection_question, author_id)
 values ('Tentativa', 'Ref', 'Texto', 'Texto', 'Pergunta', '10000000-0000-4000-8000-000000000001')$q$);
select pg_temp.affected($q$update public.devotionals set status = 'published', publish_at = now() where id = '20000000-0000-4000-8000-000000000002'$q$, 0);
select pg_temp.affected($q$delete from public.devotionals where id = '20000000-0000-4000-8000-000000000001'$q$, 0);
select pg_temp.denied('select * from public.devotional_open_counts()');
insert into public.devotional_views (devotional_id) values
 ('20000000-0000-4000-8000-000000000001'), ('20000000-0000-4000-8000-000000000001');
select pg_temp.denied($q$insert into public.devotional_views (devotional_id) values ('20000000-0000-4000-8000-000000000002')$q$);
select pg_temp.denied($q$insert into public.devotional_views (devotional_id) values ('20000000-0000-4000-8000-000000000003')$q$);
select pg_temp.denied($q$insert into public.devotional_views (devotional_id) values ('20000000-0000-4000-8000-000000000004')$q$);
select pg_temp.denied($q$insert into public.devotional_views (devotional_id, user_id) values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002')$q$);
select pg_temp.denied($q$insert into public.devotional_views (devotional_id, opened_at) values ('20000000-0000-4000-8000-000000000001', now())$q$);
select pg_temp.denied('update public.devotional_views set opened_at = now()');
select pg_temp.denied('delete from public.devotional_views');
insert into public.privacy_acknowledgements (notice_id) values ('30000000-0000-4000-8000-000000000001');
select pg_temp.denied($q$insert into public.privacy_acknowledgements (notice_id) values ('30000000-0000-4000-8000-000000000002')$q$);
select pg_temp.denied($q$insert into public.privacy_acknowledgements (notice_id, user_id) values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002')$q$);
select pg_temp.denied('delete from public.privacy_acknowledgements');
select pg_temp.denied('update public.privacy_acknowledgements set acknowledged_at = now()');
select pg_temp.denied($q$insert into public.privacy_acknowledgements (notice_id, acknowledged_at)
 values ('30000000-0000-4000-8000-000000000001', now())$q$);
select pg_temp.denied($q$update public.privacy_notice_versions set content = 'Tentativa'$q$);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select pg_temp.assert_true((select count(*) = 0 from public.devotional_views), 'second reader cannot see first reader events');
select pg_temp.assert_true((select count(*) = 0 from public.privacy_acknowledgements), 'second reader cannot see first acknowledgement');
insert into public.devotional_views (devotional_id) values ('20000000-0000-4000-8000-000000000001');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select pg_temp.assert_true(private.is_admin(), 'trusted membership grants admin');
select pg_temp.denied('select * from private.admin_users');
select pg_temp.denied($q$insert into public.devotionals (title, bible_reference, bible_text, content, reflection_question, author_id)
 values ('Autoria forjada', 'Ref', 'Texto', 'Conteúdo', 'Pergunta', '10000000-0000-4000-8000-000000000001')$q$);
select pg_temp.denied($q$update public.devotionals set author_id = '10000000-0000-4000-8000-000000000001'$q$);
select pg_temp.denied('update public.devotionals set created_at = now()');
select pg_temp.assert_true((select count(*) = 4 from public.devotionals
 where id::text like '20000000-0000-4000-8000-%'), 'admin sees all publication states');
select pg_temp.assert_true((select count(*) = 0 from public.profiles), 'admin has no bypass to personal profiles');
select pg_temp.assert_true((select count(*) = 0 from public.devotional_views), 'admin cannot read individual reader events');
select pg_temp.assert_true((select count(*) = 0 from public.privacy_acknowledgements), 'admin cannot read reader acknowledgements');
select pg_temp.assert_true((select total_opens = 3 and unique_readers = 2 from public.devotional_open_counts()
 where devotional_id = '20000000-0000-4000-8000-000000000001'), 'admin metrics count repeat opens and distinct readers');
select pg_temp.assert_true((select total_opens = 0 and unique_readers = 0 from public.devotional_open_counts()
 where devotional_id = '20000000-0000-4000-8000-000000000002'), 'metrics include zero-open devotionals');
insert into public.devotionals (title, bible_reference, bible_text, content, reflection_question, author_id)
 values ('Rascunho de teste', 'Ref', 'Texto', 'Conteúdo', 'Pergunta', '10000000-0000-4000-8000-000000000003');
select pg_temp.affected($q$update public.devotionals set status = 'scheduled', publish_at = now() + interval '1 day'
 where id = '20000000-0000-4000-8000-000000000002'$q$, 1);
select pg_temp.affected($q$update public.devotionals set status = 'published', publish_at = now()
 where id = '20000000-0000-4000-8000-000000000002'$q$, 1);
select pg_temp.affected($q$delete from public.devotionals where id = '20000000-0000-4000-8000-000000000003'$q$, 1);
select pg_temp.denied($q$insert into private.admin_users (user_id) values ('10000000-0000-4000-8000-000000000002')$q$);
select pg_temp.denied($q$update public.privacy_notice_versions set content = 'Tentativa'$q$);
reset role;

-- Revocation must take effect without issuing a replacement JWT.
delete from private.admin_users where user_id = '10000000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.assert_true(not private.is_admin(), 'membership revocation takes effect with same claims');
select pg_temp.denied('select * from public.devotional_open_counts()');
select pg_temp.affected($q$update public.devotionals set title = 'Tentativa após revogação'
 where id = '20000000-0000-4000-8000-000000000002'$q$, 0);
reset role;

rollback;
select 'Authorization checks passed; fixtures rolled back.' as result;
