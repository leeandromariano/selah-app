-- Raio-X do Texto. Contas sintéticas e dados existem só no banco descartável; tudo é desfeito no fim.
\set ON_ERROR_STOP on
begin;
create temp table study_checks(label text);
grant insert on study_checks to authenticated;
create temp table study_fixture(role_name text primary key, id uuid);
grant select, insert on study_fixture to authenticated;
create function pg_temp.ok(value boolean, label text) returns void language plpgsql as $$begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  insert into study_checks values (label);
end $$;
grant execute on function pg_temp.ok(boolean, text) to authenticated;
create function pg_temp.denied(statement text, label text) returns void language plpgsql as $$begin
  begin execute statement; exception when others then insert into study_checks values (label); return; end;
  raise exception 'FAIL: %', label;
end $$;
grant execute on function pg_temp.denied(text, text) to authenticated;

insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
select gen_random_uuid(), 'study-' || r || '@example.invalid', clock_timestamp(), jsonb_build_object('username', 'study_' || r, 'whatsapp', '+5511999990000')
from unnest(array['owner', 'reader']) r;
insert into study_fixture select substr(split_part(email, '@', 1), 7), id from auth.users where email like 'study-%@example.invalid';
delete from private.app_owner; -- só pode haver um OWNER; a transação é desfeita no fim
insert into private.app_owner(user_id) select id from study_fixture where role_name = 'owner';

-- os termos iniciais da migração entram como rascunho
select pg_temp.ok((select count(*) > 0 and count(*) filter (where status = 'published') = 0 from public.study_terms), 'termos iniciais entram como rascunho');

create function pg_temp.as_user(who text) returns void language plpgsql as $$begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from study_fixture where role_name = who), 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

-- leitor: não vê rascunho e não usa as funções do OWNER
select pg_temp.as_user('reader');
select pg_temp.ok(jsonb_array_length(public.get_study_terms('efesios', 2)) = 0, 'leitor não vê rascunho');
select pg_temp.denied($$select public.owner_list_study_terms()$$, 'leitor não lista termos do OWNER');
select pg_temp.denied($$select public.owner_save_study_term(null, 'X', array['x'], 'o', 'c', 'João 1:1', 'published', '[{"book":"joao","chapter":1,"start":1,"end":1}]'::jsonb)$$, 'leitor não cria termo');
select pg_temp.denied($$select * from public.study_terms$$, 'leitor não lê a tabela direto');
reset role;

-- OWNER: cria, publica e o leitor passa a ver só nos versículos ligados
select pg_temp.as_user('owner');
select pg_temp.ok(jsonb_array_length(public.owner_list_study_terms()) > 0, 'OWNER lista os termos');
create temp table study_new(id uuid);
grant select, insert on study_new to authenticated;
insert into study_new select public.owner_save_study_term(null, 'Termo de teste', array['teste', 'teste'], 'Original fictício.', 'Contexto fictício.', 'João 1:1', 'published',
  '[{"book":"efesios","chapter":2,"start":8,"end":9},{"book":"efesios","chapter":2,"start":8,"end":9}]'::jsonb);
reset role;
select pg_temp.ok((select count(*) = 1 from public.study_term_verses where term_id = (select id from study_new)), 'versículos repetidos viram um só');
select pg_temp.ok((select cardinality(words) = 1 from public.study_terms where id = (select id from study_new)), 'palavras repetidas viram uma só');
select pg_temp.as_user('reader');
select pg_temp.ok((select count(*) = 1 from jsonb_array_elements(public.get_study_terms('efesios', 2)) t where t->>'term' = 'Termo de teste'), 'leitor vê o termo publicado no capítulo ligado');
select pg_temp.ok(jsonb_array_length(public.get_study_terms('efesios', 1)) = 0, 'leitor não vê o termo em outro capítulo');
reset role;
-- OWNER despublica e some para o leitor; entradas inválidas são recusadas
select pg_temp.as_user('owner');
select public.owner_save_study_term((select id from study_new), 'Termo de teste', array['teste'], 'Original fictício.', 'Contexto fictício.', 'João 1:1', 'draft', '[{"book":"efesios","chapter":2,"start":8,"end":9}]'::jsonb);
select pg_temp.denied($$select public.owner_save_study_term(null, 'Sem versículos', array['x'], 'o', 'c', 'João 1:1', 'draft', '[]'::jsonb)$$, 'termo sem versículos é recusado');
select pg_temp.denied($$select public.owner_save_study_term(null, 'Livro ruim', array['x'], 'o', 'c', 'João 1:1', 'draft', '[{"book":"Livro Ruim!","chapter":1,"start":1,"end":1}]'::jsonb)$$, 'livro inválido é recusado');
select pg_temp.denied($$select public.owner_save_study_term(null, 'Status ruim', array['x'], 'o', 'c', 'João 1:1', 'qualquer', '[{"book":"joao","chapter":1,"start":1,"end":1}]'::jsonb)$$, 'status inválido é recusado');
reset role;
select pg_temp.as_user('reader');
select pg_temp.ok(jsonb_array_length(public.get_study_terms('efesios', 2)) = 0, 'termo despublicado some para o leitor');
reset role;
-- Dicionário de teologia: preenchido em lote pelo nome, aparece para o leitor só com o termo publicado; nulo mantém e vazio apaga
select pg_temp.as_user('reader');
select pg_temp.denied($$select public.owner_set_study_dictionary('[{"term":"Termo de teste","dictionary":"x"}]'::jsonb)$$, 'leitor não grava dicionário');
reset role;
select pg_temp.as_user('owner');
select pg_temp.ok((public.owner_set_study_dictionary('[{"term":"termo DE teste","dictionary":"  Verbete fictício.  "},{"term":"Não existe","dictionary":"y"}]'::jsonb)->>'updated')::integer = 1, 'dicionário grava pelo nome sem diferenciar maiúsculas');
select pg_temp.ok(public.owner_set_study_dictionary('[{"term":"Não existe","dictionary":"y"}]'::jsonb)->'missing' = '["Não existe"]'::jsonb, 'termo sem cadastro é apontado');
select pg_temp.denied($$select public.owner_set_study_dictionary(('[{"term":"Termo de teste","dictionary":"' || repeat('a', 1501) || '"}]')::jsonb)$$, 'verbete acima de 1500 é recusado');
select public.owner_save_study_term((select id from study_new), 'Termo de teste', array['teste'], 'Original fictício.', 'Contexto fictício.', 'João 1:1', 'published', '[{"book":"efesios","chapter":2,"start":8,"end":9}]'::jsonb);
select pg_temp.ok((select t->>'dictionary' = 'Verbete fictício.' from jsonb_array_elements(public.owner_list_study_terms()) t where t->>'term' = 'Termo de teste'), 'salvar sem informar dicionário mantém o verbete');
reset role;
select pg_temp.as_user('reader');
select pg_temp.ok((select t->>'dictionary' = 'Verbete fictício.' from jsonb_array_elements(public.get_study_terms('efesios', 2)) t where t->>'term' = 'Termo de teste'), 'leitor recebe o verbete do termo publicado');
reset role;
select pg_temp.as_user('owner');
select public.owner_save_study_term((select id from study_new), 'Termo de teste', array['teste'], 'Original fictício.', 'Contexto fictício.', 'João 1:1', 'published', '[{"book":"efesios","chapter":2,"start":8,"end":9}]'::jsonb, '');
select pg_temp.ok((select t->'dictionary' = 'null'::jsonb from jsonb_array_elements(public.owner_list_study_terms()) t where t->>'term' = 'Termo de teste'), 'texto vazio apaga o verbete');
reset role;
-- sem login
select pg_temp.denied($$set local role anon; select public.get_study_terms('efesios', 2)$$, 'anônimo não usa o Raio-X');
reset role;
select count(*) as verificacoes from study_checks;
rollback;
