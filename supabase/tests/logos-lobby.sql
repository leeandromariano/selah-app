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

-- Joga uma partida de ponta a ponta: abre a sessão, recua o relógio dela para o tempo jogado e fecha. Só o banco descartável de teste pode mexer no relógio.
create function pg_temp.play_run(p_mode text, p_wave integer, p_kills integer, p_seconds integer, p_won boolean) returns jsonb language plpgsql as $$
declare v_sid uuid;
begin
  v_sid := (public.logos_session_start(p_mode) ->> 'session_id')::uuid;
  reset role; update public.logos_sessions set started_at = now() - make_interval(secs => greatest(coalesce(p_seconds, 0), 0) + 1) where id = v_sid; set local role authenticated;
  return public.logos_run_finish(v_sid, p_wave, p_kills, p_seconds, p_won);
end $$;
create function pg_temp.play_phase(p_phase integer, p_won boolean, p_kills integer, p_seconds integer) returns jsonb language plpgsql as $$
declare v_sid uuid;
begin
  v_sid := (public.logos_session_start('historia', p_phase) ->> 'session_id')::uuid;
  reset role; update public.logos_sessions set started_at = now() - make_interval(secs => greatest(coalesce(p_seconds, 0), 0) + 1) where id = v_sid; set local role authenticated;
  return public.logos_phase_finish(v_sid, p_won, p_kills, p_seconds);
end $$;
grant execute on function pg_temp.play_run(text, integer, integer, integer, boolean), pg_temp.play_phase(integer, boolean, integer, integer) to authenticated;

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
select pg_temp.denied($$select pg_temp.play_run('vigilia', 3, 10, 4, false)$$, 'mais de 5 abates por segundo é implausível');
select pg_temp.denied($$select pg_temp.play_run('vigilia', 3, 10, 60, true)$$, 'a Vigília não tem vitória');
select pg_temp.denied($$select pg_temp.play_run('farol', 2, 10, 60, true)$$, 'o Farol não tem ondas');
select pg_temp.denied($$select pg_temp.play_run('outro', 0, 0, 60, false)$$, 'modo desconhecido é recusado');
select pg_temp.denied($$select pg_temp.play_run('vigilia', 0, 0, 2, false)$$, 'partida curta demais é recusada');
select pg_temp.denied($$select pg_temp.play_run('vigilia', 201, 0, 60, false)$$, 'onda acima do limite é recusada');
select pg_temp.denied($$select pg_temp.play_run(null, 0, 0, 60, false)$$, 'modo nulo é recusado');
select pg_temp.ok((pg_temp.play_run('vigilia', 4, 20, 180, false) -> 'reward' ->> 'sparks')::int = 100, 'Vigília: onda 4 e 20 abates rendem 100 Centelhas');
select pg_temp.ok((public.logos_lobby() ->> 'sparks')::int = 100, 'as Centelhas entram no saldo');
select pg_temp.ok((public.logos_lobby() ->> 'vigilia_best_wave')::int = 4, 'guarda a melhor onda');
select pg_temp.ok((pg_temp.play_run('vigilia', 2, 5, 90, false) -> 'reward' ->> 'sparks')::int = 40, 'prêmio proporcional ao desempenho');
select pg_temp.ok((public.logos_lobby() ->> 'vigilia_best_wave')::int = 4, 'a melhor onda não diminui');
select pg_temp.ok((pg_temp.play_run('vigilia', 50, 600, 900, false) -> 'reward' ->> 'sparks')::int = 300, 'o prêmio de uma partida tem teto de 300');

-- Protocolo Farol
select pg_temp.ok((pg_temp.play_run('farol', 0, 12, 120, true) -> 'reward' ->> 'sparks')::int = 174, 'Farol vencido: 150 mais 2 por abate');
select pg_temp.ok((public.logos_lobby() ->> 'farol_wins')::int = 1, 'conta a vitória do Farol');
select pg_temp.ok((pg_temp.play_run('farol', 0, 4, 60, false) -> 'reward' ->> 'sparks')::int = 34, 'Farol perdido rende menos');
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
select pg_temp.denied($$select pg_temp.play_run('vigilia', 1, 1, 60, false)$$, 'mais de 30 partidas por hora é barrado');

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
select pg_temp.denied($$set local role anon; select public.logos_run_finish(gen_random_uuid(), 1, 1, 60, false)$$, 'anônimo não registra partida');
reset role;

-- sessões: o servidor é quem abre a partida e confere o tempo
select pg_temp.as_user('ana');
select pg_temp.denied($$select public.logos_run_finish(gen_random_uuid(), 1, 1, 60, false)$$, 'sessão inexistente é recusada');
select pg_temp.denied($$select public.logos_run_finish(null, 1, 1, 60, false)$$, 'sessão nula é recusada');
select pg_temp.denied($$select public.logos_session_start('outro')$$, 'modo desconhecido não abre sessão');
select pg_temp.denied($$select public.logos_session_start('historia')$$, 'campanha exige a fase');
select pg_temp.denied($$select public.logos_session_start('vigilia', 3)$$, 'modo rápido não aceita fase');
select pg_temp.denied($$select public.logos_session_start('historia', 2)$$, 'fase bloqueada não abre sessão');
create temp table logos_sess(label text, id uuid);
grant select, insert on logos_sess to authenticated;
insert into logos_sess select 'a', (public.logos_session_start('vigilia') ->> 'session_id')::uuid;
select pg_temp.denied($$select public.logos_run_finish((select id from logos_sess where label = 'a'), 1, 1, 600, false)$$, 'não dá para declarar mais tempo do que o relógio do servidor mostra');
select pg_temp.denied($$select public.logos_run_finish((select id from logos_sess where label = 'a'), 1, 1, 60, false)$$, 'partida recém-aberta não fecha com 60 s jogados');
-- a tentativa recusada não gasta a sessão: cada recusa desfaz a gravação
reset role;
update public.logos_sessions set started_at = now() - interval '90 seconds' where id = (select id from logos_sess where label = 'a');
select pg_temp.as_user('ana');
select pg_temp.denied($$select public.logos_run_finish((select id from logos_sess where label = 'a'), 40, 1, 90, false)$$, 'onda impossível para o tempo jogado é recusada');
select pg_temp.ok((public.logos_run_finish((select id from logos_sess where label = 'a'), 2, 3, 90, false) -> 'reward' ->> 'sparks')::int = 36, 'sessão com tempo coerente fecha e paga');
select pg_temp.denied($$select public.logos_run_finish((select id from logos_sess where label = 'a'), 2, 3, 90, false)$$, 'a sessão vale uma única vez');
reset role;
select pg_temp.ok((select count(*) from public.logos_runs where session_id = (select id from logos_sess where label = 'a')) = 1, 'a partida fica ligada à sessão');
select pg_temp.ok((select mode from public.logos_runs where session_id = (select id from logos_sess where label = 'a')) = 'vigilia', 'o modo gravado é o da sessão');
select pg_temp.as_user('ana');
-- sessão de outro jogador
insert into logos_sess select 'b', (public.logos_session_start('farol') ->> 'session_id')::uuid;
select pg_temp.as_user('beto');
select pg_temp.denied($$select public.logos_run_finish((select id from logos_sess where label = 'b'), 0, 1, 5, false)$$, 'sessão de outro jogador é recusada');
-- vitória rápida demais
select pg_temp.as_user('ana');
select pg_temp.denied($$select pg_temp.play_run('farol', 0, 5, 20, true)$$, 'vencer o Farol em 20 s é implausível');
-- o jogador não lê nem escreve sessões direto
select pg_temp.denied($$select count(*) from public.logos_sessions$$, 'sessões não são legíveis direto');
select pg_temp.denied($$update public.logos_sessions set started_at = now() - interval '1 day'$$, 'o jogador não mexe no relógio da sessão');
reset role;
select count(*) as verificacoes from logos_checks;
rollback;
