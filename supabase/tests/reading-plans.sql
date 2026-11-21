-- Planos de leitura. Contas sintéticas e dados existem só no banco descartável; tudo é desfeito no fim.
\set ON_ERROR_STOP on
begin;
create temp table plan_checks(label text);
grant insert on plan_checks to authenticated;
create temp table plan_fixture(role_name text primary key, id uuid);
grant select, insert on plan_fixture to authenticated;
create function pg_temp.ok(value boolean, label text) returns void language plpgsql as $$begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  insert into plan_checks values (label);
end $$;
grant execute on function pg_temp.ok(boolean, text) to authenticated;
create function pg_temp.denied(statement text, label text) returns void language plpgsql as $$begin
  begin execute statement; exception when others then insert into plan_checks values (label); return; end;
  raise exception 'FAIL: %', label;
end $$;
grant execute on function pg_temp.denied(text, text) to authenticated;

insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
select gen_random_uuid(), 'plano-' || r || '@example.invalid', clock_timestamp(), jsonb_build_object('username', 'plano_' || r, 'whatsapp', '+5511999990000')
from unnest(array['ana', 'beto']) r;
insert into plan_fixture select substr(split_part(email, '@', 1), 7), id from auth.users where email like 'plano-%@example.invalid';

create function pg_temp.as_user(who text) returns void language plpgsql as $$begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from plan_fixture where role_name = who), 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

-- entrar nos planos
select pg_temp.as_user('ana');
select pg_temp.ok(public.reading_plans_mine() = '[]'::jsonb, 'sem adesão, a lista é vazia');
select pg_temp.ok((public.reading_plan_join('biblia-1-ano') ->> 'plan') = 'biblia-1-ano', 'entra no plano de 1 ano');
select pg_temp.ok(jsonb_array_length(public.reading_plan_join('biblia-1-ano') -> 'completed_days') = 0, 'entrar de novo não zera nem duplica');
select public.reading_plan_join('novo-testamento-90-dias');
select public.reading_plan_join('antigo-testamento-150-dias');
select pg_temp.ok(jsonb_array_length(public.reading_plans_mine()) = 3, 'os três planos podem coexistir');
select pg_temp.ok((public.reading_plan_set_day('antigo-testamento-150-dias', 150, true) -> 'completed_days') = '[150]'::jsonb, 'o último dia do plano de 150 dias é aceito');
select pg_temp.denied($$select public.reading_plan_set_day('antigo-testamento-150-dias', 151, true)$$, 'dia 151 não existe no plano de 150');
select pg_temp.denied($$select public.reading_plan_join('plano-inexistente')$$, 'plano desconhecido é recusado');
select pg_temp.denied($$select public.reading_plan_join(null)$$, 'plano nulo é recusado');

-- marcar dias
select public.reading_plan_set_day('biblia-1-ano', 3, true);
select public.reading_plan_set_day('biblia-1-ano', 1, true);
select public.reading_plan_set_day('biblia-1-ano', 3, true);
select pg_temp.ok((public.reading_plan_set_day('biblia-1-ano', 2, true) -> 'completed_days') = '[1,2,3]'::jsonb, 'dias ficam ordenados e sem repetição');
select pg_temp.ok((public.reading_plan_set_day('biblia-1-ano', 2, false) -> 'completed_days') = '[1,3]'::jsonb, 'desmarcar tira só aquele dia');
select pg_temp.denied($$select public.reading_plan_set_day('novo-testamento-90-dias', 91, true)$$, 'dia 91 não existe no plano de 90');
select pg_temp.denied($$select public.reading_plan_set_day('biblia-1-ano', 366, true)$$, 'dia 366 não existe');
select pg_temp.denied($$select public.reading_plan_set_day('biblia-1-ano', 0, true)$$, 'dia 0 não existe');
select pg_temp.ok((public.reading_plan_set_day('biblia-1-ano', 365, true) -> 'completed_days') = '[1,3,365]'::jsonb, 'o último dia do plano é aceito');
reset role;

-- privacidade entre leitores
select pg_temp.as_user('beto');
select pg_temp.ok(public.reading_plans_mine() = '[]'::jsonb, 'outro leitor não vê os planos da Ana');
select pg_temp.denied($$select public.reading_plan_set_day('biblia-1-ano', 5, true)$$, 'marcar dia sem ter entrado no plano é recusado');
select public.reading_plan_leave('biblia-1-ano');
reset role;
select pg_temp.as_user('ana');
select pg_temp.ok(jsonb_array_length(public.reading_plans_mine()) = 3, 'sair de um plano não mexe nos planos de outro leitor');
select pg_temp.denied($$select count(*) from public.reading_plan_enrollments$$, 'leitor não lê a tabela diretamente');

-- sair do plano
select public.reading_plan_leave('biblia-1-ano');
select pg_temp.ok(jsonb_array_length(public.reading_plans_mine()) = 2, 'sair do plano apaga só aquele plano');
reset role;

-- sem login
select pg_temp.denied($$set local role anon; select public.reading_plans_mine()$$, 'anônimo não lista planos');
reset role;
select pg_temp.denied($$set local role anon; select public.reading_plan_join('biblia-1-ano')$$, 'anônimo não entra em plano');
reset role;
select count(*) as verificacoes from plan_checks;
rollback;
