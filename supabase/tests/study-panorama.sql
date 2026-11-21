-- Panorama dos livros. Contas sintéticas e dados existem só no banco descartável; tudo é desfeito no fim.
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
select gen_random_uuid(), 'pano-' || r || '@example.invalid', clock_timestamp(), jsonb_build_object('username', 'pano_' || r, 'whatsapp', '+5511999990000')
from unnest(array['owner', 'reader']) r;
insert into study_fixture select substr(split_part(email, '@', 1), 6), id from auth.users where email like 'pano-%@example.invalid';
delete from private.app_owner; -- só pode haver um OWNER; a transação é desfeita no fim
insert into private.app_owner(user_id) select id from study_fixture where role_name = 'owner';

create function pg_temp.as_user(who text) returns void language plpgsql as $$begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from study_fixture where role_name = who), 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

-- leitor: sem panorama publicado vem nulo; não usa as funções do OWNER nem lê a tabela
select pg_temp.as_user('reader');
select pg_temp.ok(public.get_study_panorama('romanos') is null, 'sem panorama publicado vem nulo');
select pg_temp.denied($$select public.owner_list_study_panoramas()$$, 'leitor não lista panoramas do OWNER');
select pg_temp.denied($$select public.owner_save_study_panorama('romanos', 'a', 'b', 'c', 'd', 'published')$$, 'leitor não grava panorama');
select pg_temp.denied($$select * from public.study_book_panoramas$$, 'leitor não lê a tabela direto');
select pg_temp.denied($$select public.get_study_panorama('Livro Ruim!')$$, 'livro inválido é recusado');
reset role;

-- OWNER: rascunho não aparece para o leitor; publicado aparece; atualizar troca o conteúdo (um por livro)
select pg_temp.as_user('owner');
select public.owner_save_study_panorama('romanos', '  Paulo  ', 'Cristãos em Roma', 'Carta escrita por volta de 57 d.C.', 'A justiça de Deus pela fé', 'draft');
select pg_temp.ok((select count(*) = 1 from jsonb_array_elements(public.owner_list_study_panoramas()) p where p->>'book' = 'romanos' and p->>'author' = 'Paulo' and p->>'status' = 'draft'), 'OWNER lista o rascunho, sem espaços sobrando');
select pg_temp.denied($$select public.owner_save_study_panorama('romanos', '', 'b', 'c', 'd', 'draft')$$, 'campo vazio é recusado');
select pg_temp.denied($$select public.owner_save_study_panorama('romanos', 'a', 'b', repeat('x', 301), 'd', 'draft')$$, 'contexto acima de uma frase curta é recusado');
select pg_temp.denied($$select public.owner_save_study_panorama('romanos', 'a', 'b', 'c', 'd', 'qualquer')$$, 'status inválido é recusado');
reset role;
select pg_temp.as_user('reader');
select pg_temp.ok(public.get_study_panorama('romanos') is null, 'leitor não vê rascunho');
reset role;
select pg_temp.as_user('owner');
select public.owner_save_study_panorama('romanos', 'Paulo', 'Cristãos em Roma', 'Carta escrita por volta de 57 d.C.', 'A justiça de Deus pela fé', 'published');
select public.owner_save_study_panorama('romanos', 'Paulo, o apóstolo', 'Cristãos em Roma', 'Carta escrita por volta de 57 d.C.', 'A justiça de Deus pela fé', 'published');
reset role;
select pg_temp.ok((select count(*) = 1 from public.study_book_panoramas where book = 'romanos'), 'salvar de novo atualiza, não duplica');
select pg_temp.as_user('reader');
select pg_temp.ok(public.get_study_panorama('romanos')->>'author' = 'Paulo, o apóstolo' and public.get_study_panorama('romanos')->>'theme' = 'A justiça de Deus pela fé', 'leitor vê o panorama publicado');
select pg_temp.ok(public.get_study_panorama('levitico') is null, 'leitor não vê panorama de outro livro');
reset role;

-- OWNER despublica (some para o leitor), exclui e o leitor não exclui
select pg_temp.as_user('owner');
select public.owner_save_study_panorama('romanos', 'Paulo', 'Cristãos em Roma', 'Carta.', 'Tema.', 'draft');
reset role;
select pg_temp.as_user('reader');
select pg_temp.ok(public.get_study_panorama('romanos') is null, 'panorama despublicado some para o leitor');
select pg_temp.denied($$select public.owner_delete_study_panorama('romanos')$$, 'leitor não exclui panorama');
reset role;
select pg_temp.as_user('owner');
select public.owner_delete_study_panorama('romanos');
select pg_temp.ok(jsonb_array_length(public.owner_list_study_panoramas()) = 0, 'OWNER exclui o panorama');
reset role;

-- sem login
select pg_temp.denied($$set local role anon; select public.get_study_panorama('romanos')$$, 'anônimo não usa o panorama');
reset role;
select count(*) as verificacoes from study_checks;
rollback;
