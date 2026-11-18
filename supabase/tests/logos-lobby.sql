-- CORAM // LOGOS: lobby, armadura e fim de partida. Contas sintéticas só no banco descartável; tudo é desfeito no fim.
\set ON_ERROR_STOP on
begin;
create temp table logos_checks(label text);
grant insert on logos_checks to authenticated;
create temp table logos_fixture(role_name text primary key, id uuid);
grant select, insert on logos_fixture to authenticated;
create function pg_temp.ok(value boolean, label text) returns void language plpgsql as $$begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  insert into logos_checks values (label);
end $$;
grant execute on function pg_temp.ok(boolean, text) to authenticated;
create function pg_temp.denied(statement text, label text) returns void language plpgsql as $$begin
  begin execute statement; exception when others then insert into logos_checks values (label); return; end;
  raise exception 'FAIL: %', label;
end $$;
grant execute on function pg_temp.denied(text, text) to authenticated;

insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
select gen_random_uuid(), 'logos-' || r || '@example.invalid', clock_timestamp(), jsonb_build_object('username', 'logos_' || r, 'whatsapp', '+5511999990000')
from unnest(array['ana', 'beto']) r;
insert into logos_fixture select substr(split_part(email, '@', 1), 7), id from auth.users where email like 'logos-%@example.invalid';

create function pg_temp.as_user(who text) returns void language plpgsql as $$begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from logos_fixture where role_name = who), 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

-- lobby: começa zerado, todas as peças no nível 1
select pg_temp.as_user('ana');
select pg_temp.ok((public.logos_lobby() ->> 'sparks')::int = 0, 'o jogador começa com 0 Centelhas');
select pg_temp.ok((public.logos_lobby() ->> 'level')::int = 1, 'começa no nível 1');
select pg_temp.ok((select count(*) from jsonb_each(public.logos_lobby() -> 'armadura')) = 6, 'a armadura tem as 6 peças');
select pg_temp.ok((select bool_and(value::int = 1) from jsonb_each_text(public.logos_lobby() -> 'armadura')), 'toda peça começa no nível 1');

-- sem Centelhas não dá para aprimorar
select pg_temp.denied($$select public.logos_armadura_upgrade('espada')$$, 'sem Centelhas não aprimora');
select pg_temp.denied($$select public.logos_armadura_upgrade('invalida')$$, 'peça inexistente é recusada');
select pg_temp.denied($$select public.logos_armadura_upgrade(null)$$, 'peça nula é recusada');

-- partidas: Vigília
select pg_temp.denied($$select public.logos_run_finish('vigilia', 3, 10, 4, false)$$, 'mais de 5 abates por segundo é implausível');
select pg_temp.denied($$select public.logos_run_finish('vigilia', 3, 10, 60, true)$$, 'a Vigília não tem vitória');
select pg_temp.denied($$select public.logos_run_finish('farol', 2, 10, 60, true)$$, 'o Farol não tem ondas');
select pg_temp.denied($$select public.logos_run_finish('outro', 0, 0, 60, false)$$, 'modo desconhecido é recusado');
select pg_temp.denied($$select public.logos_run_finish('vigilia', 0, 0, 2, false)$$, 'partida curta demais é recusada');
select pg_temp.denied($$select public.logos_run_finish('vigilia', 201, 0, 60, false)$$, 'onda acima do limite é recusada');
select pg_temp.denied($$select public.logos_run_finish(null, 0, 0, 60, false)$$, 'modo nulo é recusado');
select pg_temp.ok((public.logos_run_finish('vigilia', 4, 20, 180, false) -> 'reward' ->> 'sparks')::int = 100, 'Vigília: onda 4 e 20 abates rendem 100 Centelhas');
select pg_temp.ok((public.logos_lobby() ->> 'sparks')::int = 100, 'as Centelhas entram no saldo');
select pg_temp.ok((public.logos_lobby() ->> 'vigilia_best_wave')::int = 4, 'guarda a melhor onda');
select pg_temp.ok((public.logos_run_finish('vigilia', 2, 5, 90, false) -> 'reward' ->> 'sparks')::int = 40, 'prêmio proporcional ao desempenho');
select pg_temp.ok((public.logos_lobby() ->> 'vigilia_best_wave')::int = 4, 'a melhor onda não diminui');
select pg_temp.ok((public.logos_run_finish('vigilia', 50, 600, 900, false) -> 'reward' ->> 'sparks')::int = 300, 'o prêmio de uma partida tem teto de 300');

-- Protocolo Farol
select pg_temp.ok((public.logos_run_finish('farol', 0, 12, 120, true) -> 'reward' ->> 'sparks')::int = 174, 'Farol vencido: 150 mais 2 por abate');
select pg_temp.ok((public.logos_lobby() ->> 'farol_wins')::int = 1, 'conta a vitória do Farol');
select pg_temp.ok((public.logos_run_finish('farol', 0, 4, 60, false) -> 'reward' ->> 'sparks')::int = 34, 'Farol perdido rende menos');
select pg_temp.ok((public.logos_lobby() ->> 'farol_runs')::int = 2, 'conta as partidas do Farol');
select pg_temp.ok((public.logos_lobby() ->> 'xp')::int > 0 and (public.logos_lobby() ->> 'level')::int >= 1, 'a experiência acumula');

-- aprimorar: saldo 100+40+300+174+34 = 648
select pg_temp.ok((public.logos_lobby() ->> 'sparks')::int = 648, 'saldo conferido antes de gastar');
select pg_temp.ok((public.logos_armadura_upgrade('espada') -> 'armadura' ->> 'espada')::int = 2, 'espada vai ao nível 2');
select pg_temp.ok((public.logos_lobby() ->> 'sparks')::int = 548, 'nível 1→2 custa 100');
select pg_temp.ok((public.logos_armadura_upgrade('espada') -> 'armadura' ->> 'espada')::int = 3, 'espada vai ao nível 3');
select pg_temp.ok((public.logos_lobby() ->> 'sparks')::int = 348, 'nível 2→3 custa 200');
select pg_temp.ok((public.logos_armadura_upgrade('espada') -> 'armadura' ->> 'espada')::int = 4, 'espada vai ao nível 4');
select pg_temp.ok((public.logos_lobby() ->> 'sparks')::int = 48, 'nível 3→4 custa 300');
select pg_temp.denied($$select public.logos_armadura_upgrade('espada')$$, 'saldo insuficiente barra o nível 5');
select pg_temp.ok((public.logos_lobby() -> 'armadura' ->> 'escudo')::int = 1, 'as outras peças não mudam');

-- limite por hora: 30 partidas
reset role;
insert into public.logos_runs(user_id, mode, kills, seconds)
select (select id from logos_fixture where role_name = 'beto'), 'vigilia', 0, 60 from generate_series(1, 30);
select pg_temp.as_user('beto');
select pg_temp.denied($$select public.logos_run_finish('vigilia', 1, 1, 60, false)$$, 'mais de 30 partidas por hora é barrado');

-- isolamento entre jogadores
select pg_temp.as_user('beto');
select pg_temp.ok((public.logos_lobby() ->> 'sparks')::int = 0, 'o outro jogador não vê as Centelhas da Ana');
select pg_temp.denied($$select * from public.logos_player_progress$$, 'tabela de progresso não é legível direto');
select pg_temp.denied($$select * from public.logos_armadura$$, 'tabela de armadura não é legível direto');
select pg_temp.denied($$select * from public.logos_runs$$, 'histórico de partidas não é legível direto');
select pg_temp.denied($$update public.logos_player_progress set sparks = 99999$$, 'não dá para editar Centelhas direto');

-- sem login
reset role;
select pg_temp.denied($$set local role anon; select public.logos_lobby()$$, 'anônimo não abre o lobby');
reset role;
select pg_temp.denied($$set local role anon; select public.logos_run_finish('vigilia', 1, 1, 60, false)$$, 'anônimo não registra partida');
reset role;
select count(*) as verificacoes from logos_checks;
rollback;
