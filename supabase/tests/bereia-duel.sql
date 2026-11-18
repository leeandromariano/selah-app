-- Bereia 1v1 (duelo). Contas sintéticas e dados existem só no banco descartável; tudo é desfeito no fim.
\set ON_ERROR_STOP on
begin;
create temp table duel_checks(label text);
grant insert on duel_checks to authenticated;
create temp table duel_fixture(role_name text primary key, id uuid);
grant select, insert on duel_fixture to authenticated;
create temp table duel_q(n int, id uuid);
grant select on duel_q to authenticated;
create temp table duel_ctx(code text);
grant select, insert, update on duel_ctx to authenticated;
create function pg_temp.ok(value boolean, label text) returns void language plpgsql as $$begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  insert into duel_checks values (label);
end $$;
grant execute on function pg_temp.ok(boolean, text) to authenticated;
create function pg_temp.denied(statement text, label text) returns void language plpgsql as $$begin
  begin execute statement; exception when others then insert into duel_checks values (label); return; end;
  raise exception 'FAIL: %', label;
end $$;
grant execute on function pg_temp.denied(text, text) to authenticated;

insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
select gen_random_uuid(), 'duelo-' || r || '@example.invalid', clock_timestamp(), jsonb_build_object('username', 'duelo_' || r, 'whatsapp', '+5511999990000')
from unnest(array['ana', 'beto', 'caio']) r;
insert into duel_fixture select substr(split_part(email, '@', 1), 7), id from auth.users where email like 'duelo-%@example.invalid';

-- perguntas de teste só deste banco descartável (nível 4, para não misturar com as reais)
insert into public.quiz_questions (testament, level, prompt, options, correct_index, reference)
select 'antigo', 4, 'Pergunta de teste ' || g, '["A","B","C","D"]'::jsonb, 1, 'Gênesis 1:' || g from generate_series(1, 12) g;

create function pg_temp.as_user(who text) returns void language plpgsql as $$begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from duel_fixture where role_name = who), 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

-- criar
update public.quiz_questions set active = false where level = 4 and prompt not like 'Pergunta de teste%'; -- só as perguntas de teste ficam no nível 4: sem 'novo' e com respostas conhecidas
select pg_temp.as_user('ana');
select pg_temp.denied($$select public.duel_create('xyz', 4, 5)$$, 'modalidade inválida é recusada');
select pg_temp.denied($$select public.duel_create('antigo', 9, 5)$$, 'nível inválido é recusado');
select pg_temp.denied($$select public.duel_create('antigo', 4, 7)$$, 'tamanho diferente de 5 ou 10 é recusado');
select pg_temp.denied($$select public.duel_create('novo', 4, 5)$$, 'sem perguntas suficientes na combinação é recusado');
insert into duel_ctx select public.duel_create('antigo', 4, 5) ->> 'code';
select pg_temp.ok((select code ~ '^[a-z0-9]{10}$' from duel_ctx), 'o código tem 10 caracteres');
reset role;
insert into duel_q select t.ord::int, t.qid from public.quiz_duels d, unnest(d.question_ids) with ordinality as t(qid, ord);
select pg_temp.as_user('ana');
select pg_temp.ok((select jsonb_array_length(public.duel_open((select code from duel_ctx)) -> 'questions')) = 5, 'o criador recebe as 5 perguntas');
select pg_temp.ok(not (public.duel_open((select code from duel_ctx))::text like '%correct_index%'), 'as perguntas chegam sem a resposta certa');
select pg_temp.ok((public.duel_open((select code from duel_ctx)) ->> 'is_creator')::boolean, 'quem criou aparece como criador');
reset role;

-- responder (Ana acerta 3 de 5: a resposta certa é a opção 1)
select pg_temp.as_user('ana');
select pg_temp.ok((public.duel_answer((select code from duel_ctx), (select id from duel_q where n = 1), 1, 3000) ->> 'correct')::boolean, 'resposta certa é reconhecida');
select pg_temp.ok((public.duel_answer((select code from duel_ctx), (select id from duel_q where n = 1), 0, 100) ->> 'counted')::boolean = false, 'responder de novo não conta');
select pg_temp.denied($$select public.duel_result((select code from duel_ctx))$$, 'sem terminar não há placar');
select public.duel_answer((select code from duel_ctx), (select id from duel_q where n = 2), 1, 4000);
select public.duel_answer((select code from duel_ctx), (select id from duel_q where n = 3), 1, 5000);
select public.duel_answer((select code from duel_ctx), (select id from duel_q where n = 4), 0, 6000);
select pg_temp.ok((public.duel_answer((select code from duel_ctx), (select id from duel_q where n = 5), -1, 99999) ->> 'finished')::boolean, 'a quinta resposta encerra o duelo (tempo esgotado = -1)');
select pg_temp.ok((public.duel_result((select code from duel_ctx)) -> 'players' -> 0 ->> 'correct')::int = 3, 'Ana fez 3 acertos');
select pg_temp.ok((public.duel_result((select code from duel_ctx)) -> 'players' -> 0 ->> 'total_ms')::int = 33000, 'tempo soma só as respostas contadas e limita o tempo esgotado a 15 s');
select pg_temp.denied($$select public.duel_answer((select code from duel_ctx), gen_random_uuid(), 1, 1000)$$, 'pergunta fora do duelo é recusada');
select pg_temp.denied($$select public.duel_answer((select code from duel_ctx), (select id from duel_q where n = 1), 7, 1000)$$, 'opção inválida é recusada');
reset role;

-- o amigo entra pelo link e responde as MESMAS perguntas
select pg_temp.as_user('beto');
select pg_temp.denied($$select public.duel_answer((select code from duel_ctx), (select id from duel_q where n = 1), 1, 1000)$$, 'quem não abriu o duelo não responde');
select pg_temp.ok(public.duel_open((select code from duel_ctx)) -> 'questions' = (select public.duel_open((select code from duel_ctx)) -> 'questions'), 'o amigo abre o duelo');
select pg_temp.ok(not (public.duel_open((select code from duel_ctx)) ->> 'is_creator')::boolean, 'o amigo não é o criador');
select pg_temp.denied($$select public.duel_result((select code from duel_ctx))$$, 'o amigo não vê o placar antes de terminar');
select public.duel_answer((select code from duel_ctx), (select id from duel_q where n = 1), 1, 2000);
select public.duel_answer((select code from duel_ctx), (select id from duel_q where n = 2), 1, 2000);
select public.duel_answer((select code from duel_ctx), (select id from duel_q where n = 3), 1, 2000);
select public.duel_answer((select code from duel_ctx), (select id from duel_q where n = 4), 1, 2000);
select public.duel_answer((select code from duel_ctx), (select id from duel_q where n = 5), 1, 2000);
select pg_temp.ok((public.duel_result((select code from duel_ctx)) -> 'players' -> 0 ->> 'correct')::int = 5, 'Beto lidera com 5 acertos');
select pg_temp.ok((public.duel_result((select code from duel_ctx)) -> 'players' -> 0 ->> 'is_me')::boolean, 'o placar marca quem sou eu');
select pg_temp.ok((public.duel_result((select code from duel_ctx)) -> 'players' -> 1 ->> 'is_creator')::boolean, 'o criador aparece no placar');
select pg_temp.ok(jsonb_array_length(public.duel_mine()) = 1, 'o duelo aparece em "meus duelos"');
reset role;

-- terceiros, código ruim e acesso direto
select pg_temp.as_user('caio');
select pg_temp.ok(public.duel_mine() = '[]'::jsonb, 'quem não participou não vê o duelo em "meus duelos"');
select pg_temp.denied($$select public.duel_result((select code from duel_ctx))$$, 'quem não participou não vê o placar');
select pg_temp.denied($$select public.duel_open('codigo-ruim')$$, 'código inválido é recusado');
select pg_temp.denied($$select public.duel_open('aaaaaaaaaa')$$, 'duelo inexistente é recusado');
select pg_temp.denied($$select count(*) from public.quiz_duels$$, 'não lê a tabela de duelos diretamente');
select pg_temp.denied($$select count(*) from public.quiz_duel_answers$$, 'não lê as respostas diretamente');
reset role;

-- duelo expirado
update public.quiz_duels set expires_at = now() - interval '1 minute';
select pg_temp.as_user('caio');
select pg_temp.denied($$select public.duel_open((select code from duel_ctx))$$, 'duelo expirado não abre');
reset role;
update public.quiz_duels set expires_at = now() + interval '7 days';

-- limite de 20 jogadores
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
select gen_random_uuid(), 'extra-' || g || '@example.invalid', clock_timestamp(), jsonb_build_object('username', 'extra_' || g, 'whatsapp', '+5511999990000') from generate_series(1, 18) g;
insert into public.quiz_duel_players (duel_id, user_id) select (select id from public.quiz_duels limit 1), id from auth.users where email like 'extra-%@example.invalid';
select pg_temp.as_user('caio');
select pg_temp.denied($$select public.duel_open((select code from duel_ctx))$$, 'o duelo aceita no máximo 20 jogadores');
reset role;

-- limite de criação por hora
select pg_temp.as_user('ana');
select public.duel_create('antigo', 4, 5) from generate_series(1, 9);
select pg_temp.denied($$select public.duel_create('antigo', 4, 5)$$, 'limite de 10 duelos por hora');
reset role;

-- sem login
select pg_temp.denied($$set local role anon; select public.duel_open('aaaaaaaaaa')$$, 'anônimo não abre duelo');
reset role;
select pg_temp.denied($$set local role anon; select public.duel_create('antigo', 4, 5)$$, 'anônimo não cria duelo');
reset role;
select count(*) as verificacoes from duel_checks;
rollback;
