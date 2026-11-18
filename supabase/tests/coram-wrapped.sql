-- CORAM Wrapped. Contas sintéticas e dados existem só no banco descartável; tudo é desfeito no fim.
\set ON_ERROR_STOP on
begin;
create temp table wrap_checks(label text);
grant insert on wrap_checks to authenticated;
create temp table wrap_fixture(role_name text primary key, id uuid);
grant select, insert on wrap_fixture to authenticated;
create function pg_temp.ok(value boolean, label text) returns void language plpgsql as $$begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  insert into wrap_checks values (label);
end $$;
grant execute on function pg_temp.ok(boolean, text) to authenticated;
create function pg_temp.denied(statement text, label text) returns void language plpgsql as $$begin
  begin execute statement; exception when others then insert into wrap_checks values (label); return; end;
  raise exception 'FAIL: %', label;
end $$;
grant execute on function pg_temp.denied(text, text) to authenticated;

insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
select gen_random_uuid(), 'wrap-' || r || '@example.invalid', clock_timestamp(), jsonb_build_object('username', 'wrap_' || r, 'whatsapp', '+5511999990000')
from unnest(array['ana', 'beto']) r;
insert into wrap_fixture select substr(split_part(email, '@', 1), 6), id from auth.users where email like 'wrap-%@example.invalid';

-- três devocionais de teste (autor = a própria Ana, só neste banco descartável)
create temp table wrap_dev(name text primary key, id uuid);
insert into wrap_dev select n, gen_random_uuid() from unnest(array['joao', 'salmos', 'cor']) n;
insert into public.devotionals(id, title, bible_reference, bible_text, content, reflection_question, publish_at, status, author_id)
select d.id, 'Devocional ' || d.name, case d.name when 'joao' then 'João 3:16-18' when 'salmos' then 'Salmos 23' else '1 Coríntios 13' end,
  'Texto', 'Conteúdo', 'Pergunta?', '2025-01-01', 'published', (select id from wrap_fixture where role_name = 'ana') from wrap_dev d;

-- Março de 2025: 4 dias com devocional concluído (1, 2, 3 e 5 = sequência de 3), mais 1 de abril fora do período
insert into public.devotional_completions(user_id, source_devotional_id, revision, completed_at, completed_day)
select (select id from wrap_fixture where role_name = 'ana'), v.src, 1, (v.d::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo', v.d
from (values ((select id from wrap_dev where name = 'joao'), date '2025-03-01'), ((select id from wrap_dev where name = 'salmos'), date '2025-03-02'),
  ((select id from wrap_dev where name = 'cor'), date '2025-03-03'), (gen_random_uuid(), date '2025-03-05'), (gen_random_uuid(), date '2025-04-01')) v(src, d);
-- aberturas: João 3 vezes em março, Salmos 1 vez, e uma de João em abril (fora)
insert into public.devotional_views(devotional_id, user_id, opened_at)
select (select id from wrap_dev where name = 'joao'), (select id from wrap_fixture where role_name = 'ana'), t
from unnest(array[timestamptz '2025-03-01 10:00-03', timestamptz '2025-03-04 10:00-03', timestamptz '2025-03-09 10:00-03', timestamptz '2025-04-02 10:00-03']) t;
insert into public.devotional_views(devotional_id, user_id, opened_at)
values ((select id from wrap_dev where name = 'salmos'), (select id from wrap_fixture where role_name = 'ana'), timestamptz '2025-03-02 10:00-03');
-- Bereia: 3 respostas de quiz em março (2 certas) e 1 em abril
insert into public.quiz_answers(user_id, question_id, selected_index, is_correct, answered_at)
select (select id from wrap_fixture where role_name = 'ana'), q.id, 0, q.n <= 2, case when q.n <= 3 then timestamptz '2025-03-10 12:00-03' else timestamptz '2025-04-10 12:00-03' end
from (select id, row_number() over (order by id) n from public.quiz_questions limit 4) q;

create function pg_temp.as_user(who text) returns void language plpgsql as $$begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from wrap_fixture where role_name = who), 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

select pg_temp.as_user('ana');
create temp table wrap_out(j jsonb);
grant select, insert on wrap_out to authenticated;
insert into wrap_out select public.get_my_wrapped('month', 2025, 3);
select pg_temp.ok((select (j -> 'presence' ->> 'days')::int from wrap_out) = 4, 'conta os dias distintos com devocional concluído no mês');
select pg_temp.ok((select (j -> 'presence' ->> 'longest_streak')::int from wrap_out) = 3, 'a maior sequência do mês (1, 2 e 3) é 3');
select pg_temp.ok((select (j -> 'presence' ->> 'completed')::int from wrap_out) = 4, 'conta os devocionais concluídos só do mês');
select pg_temp.ok((select j ->> 'start' from wrap_out) = '2025-03-01' and (select j ->> 'end' from wrap_out) = '2025-03-31', 'o período vai de 1 a 31 de março');
select pg_temp.ok(not (select (j ->> 'partial')::boolean from wrap_out), 'um mês passado não é parcial');
select pg_temp.ok((select jsonb_array_length(j -> 'books') from wrap_out) = 3, 'três livros no mês (a abertura de abril não entra)');
select pg_temp.ok((select (b ->> 'count')::int from wrap_out, jsonb_array_elements(j -> 'books') b where b ->> 'key' = 'joão') = 1, 'cada devocional conta uma vez por livro, mesmo aberto várias vezes');
select pg_temp.ok((select j -> 'verse' ->> 'reference' from wrap_out) = 'João 3:16-18', 'o versículo mais revisitado é o aberto mais vezes');
select pg_temp.ok((select (j -> 'verse' ->> 'opens')::int from wrap_out) = 3, 'conta só as aberturas do mês (a de abril fica de fora)');
select pg_temp.ok((select (g ->> 'answered')::int from wrap_out, jsonb_array_elements(j -> 'bereia' -> 'games') g where g ->> 'game' = 'quiz') = 3, 'o quiz conta só as respostas do mês');
select pg_temp.ok((select (g ->> 'correct')::int from wrap_out, jsonb_array_elements(j -> 'bereia' -> 'games') g where g ->> 'game' = 'quiz') = 2, 'e só os acertos do mês');
select pg_temp.ok((select jsonb_array_length(j -> 'bereia' -> 'games') from wrap_out) = 5, 'os cinco jogos aparecem, mesmo sem respostas');
select pg_temp.ok((public.get_my_wrapped('year', 2025) -> 'presence' ->> 'days')::int = 5, 'o ano soma os dias do ano inteiro');
select pg_temp.ok((public.get_my_wrapped('month', extract(year from now() at time zone 'America/Sao_Paulo')::int, extract(month from now() at time zone 'America/Sao_Paulo')::int) ->> 'partial')::boolean, 'o mês corrente é parcial');
select pg_temp.denied($$select public.get_my_wrapped('week', 2025, 3)$$, 'período desconhecido é recusado');
select pg_temp.denied($$select public.get_my_wrapped('month', 2025, 13)$$, 'mês 13 é recusado');
select pg_temp.denied($$select public.get_my_wrapped('month', 2025, null)$$, 'mês sem número é recusado');
select pg_temp.denied($$select public.get_my_wrapped('year', 2025, 3)$$, 'ano com mês é recusado');
select pg_temp.denied($$select public.get_my_wrapped('year', 2024)$$, 'ano antes do app existir é recusado');
select pg_temp.denied($$select public.get_my_wrapped('year', 2100)$$, 'período que ainda não começou é recusado');
reset role;

-- outro leitor não vê nada da Ana
select pg_temp.as_user('beto');
select pg_temp.ok((public.get_my_wrapped('month', 2025, 3) -> 'presence' ->> 'days')::int = 0, 'outro leitor não enxerga os dias da Ana');
select pg_temp.ok(public.get_my_wrapped('month', 2025, 3) -> 'books' = '[]'::jsonb and public.get_my_wrapped('month', 2025, 3) -> 'verse' = 'null'::jsonb, 'nem os livros nem o versículo');
reset role;

-- sem login
select pg_temp.denied($$set local role anon; select public.get_my_wrapped('month', 2025, 3)$$, 'anônimo não acessa o Wrapped');
reset role;
select count(*) as verificacoes from wrap_checks;
rollback;
