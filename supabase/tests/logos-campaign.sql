-- CORAM // LOGOS, campanha: desbloqueio, fragmentos e prêmios. Contas sintéticas só no banco descartável; tudo é desfeito no fim.
\set ON_ERROR_STOP on
begin;
create temp table camp_checks(label text);
grant insert on camp_checks to authenticated;
create temp table camp_fixture(role_name text primary key, id uuid);
grant select, insert on camp_fixture to authenticated;
create function pg_temp.ok(value boolean, label text) returns void language plpgsql as $$begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  insert into camp_checks values (label);
end $$;
grant execute on function pg_temp.ok(boolean, text) to authenticated;
create function pg_temp.denied(statement text, label text) returns void language plpgsql as $$begin
  begin execute statement; exception when others then insert into camp_checks values (label); return; end;
  raise exception 'FAIL: %', label;
end $$;
grant execute on function pg_temp.denied(text, text) to authenticated;

insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
select gen_random_uuid(), 'camp-' || r || '@example.invalid', clock_timestamp(), jsonb_build_object('username', 'camp_' || r, 'whatsapp', '+5511999990000')
from unnest(array['ana', 'beto']) r;
insert into camp_fixture select substr(split_part(email, '@', 1), 6), id from auth.users where email like 'camp-%@example.invalid';
create function pg_temp.as_user(who text) returns void language plpgsql as $$begin
  reset role;
  delete from private.app_owner; insert into private.app_owner(user_id) select id from camp_fixture where role_name = who;
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from camp_fixture where role_name = who), 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
create function pg_temp.as_guest(who text) returns void language plpgsql as $$begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from camp_fixture where role_name = who), 'role', 'authenticated')::text, true);
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

select pg_temp.as_user('ana');
select pg_temp.ok(public.logos_campaign() = '{"fragments": []}'::jsonb, 'sem vitórias, não há fragmentos');
select pg_temp.denied($$select pg_temp.play_phase(2, true, 5, 60)$$, 'a fase 2 está bloqueada antes da fase 1');
select pg_temp.denied($$select pg_temp.play_phase(0, true, 5, 60)$$, 'fase 0 não existe');
select pg_temp.denied($$select pg_temp.play_phase(17, true, 5, 60)$$, 'fase 17 não existe');
select pg_temp.denied($$select pg_temp.play_phase(null, true, 5, 60)$$, 'fase nula é recusada');
select pg_temp.denied($$select pg_temp.play_phase(1, true, 50, 5)$$, 'mais de 5 abates por segundo é implausível');
select pg_temp.denied($$select pg_temp.play_phase(1, true, 5, 2)$$, 'partida curta demais é recusada');

-- derrota não dá fragmento e rende pouco
select pg_temp.ok((pg_temp.play_phase(1, false, 3, 40) -> 'reward' ->> 'sparks')::int = 3, 'derrota rende uma Centelha por abate (até 40)');
select pg_temp.ok((pg_temp.play_phase(1, false, 3, 40) -> 'fragment') = 'null'::jsonb, 'derrota não entrega fragmento');
select pg_temp.ok(public.logos_campaign() = '{"fragments": []}'::jsonb, 'a derrota não abre a fase seguinte');
select pg_temp.denied($$select pg_temp.play_phase(2, true, 5, 60)$$, 'continua bloqueada depois de uma derrota');

-- vitória: fragmento, prêmio cheio e fase seguinte aberta
select pg_temp.ok((pg_temp.play_phase(1, true, 12, 90) -> 'fragment' ->> 'reference') = 'Mateus 4:4', 'a fase 1 entrega Mateus 4:4');
select pg_temp.ok((public.logos_lobby() ->> 'sparks')::int = 3 + 3 + 100, 'saldo: prêmio da fase 1 (100) mais as derrotas');
select pg_temp.ok(jsonb_array_length(public.logos_campaign() -> 'fragments') = 1, 'o fragmento fica salvo');
select pg_temp.ok((pg_temp.play_phase(2, true, 20, 100) -> 'fragment' ->> 'is_new')::boolean, 'a fase 2 abriu e o fragmento é novo');

-- repetir rende 30% e não duplica
select pg_temp.ok((pg_temp.play_phase(1, true, 12, 70) -> 'reward' ->> 'sparks')::int = 30, 'repetir a fase 1 rende 30%');
select pg_temp.ok(not (pg_temp.play_phase(1, true, 12, 80) -> 'fragment' ->> 'is_new')::boolean, 'repetir não marca o fragmento como novo');
select pg_temp.ok((select (f ->> 'clears')::int from jsonb_array_elements(public.logos_campaign() -> 'fragments') f where f ->> 'phase' = '1') = 3, 'conta as vitórias da fase');
select pg_temp.ok((select (f ->> 'best_seconds')::int from jsonb_array_elements(public.logos_campaign() -> 'fragments') f where f ->> 'phase' = '1') = 70, 'guarda o melhor tempo');
select pg_temp.ok(jsonb_array_length(public.logos_campaign() -> 'fragments') = 2, 'repetir não cria outro registro');

-- chefes pagam mais: fase 4 exige a 3
select pg_temp.denied($$select pg_temp.play_phase(4, true, 5, 60)$$, 'a fase 4 exige a 3');
select pg_temp.play_phase(3, true, 10, 60);
select pg_temp.ok((pg_temp.play_phase(4, true, 10, 60) -> 'reward' ->> 'sparks')::int = 100 + 30 + 100, 'fase de chefe: bônus de 100');
select pg_temp.ok((pg_temp.play_phase(4, true, 10, 60) -> 'fragment' ->> 'reference') = 'Mateus 4:10', 'a fase 4 entrega Mateus 4:10');
reset role;
select pg_temp.ok(private.logos_fragment_reference(16) = 'João 19:30' and private.logos_fragment_reference(7) = 'Salmos 23:4', 'as referências seguem a ordem das fases');

-- isolamento e acesso direto
select pg_temp.as_user('beto');
select pg_temp.ok(public.logos_campaign() = '{"fragments": []}'::jsonb, 'o outro jogador não vê os fragmentos da Ana');
select pg_temp.denied($$select pg_temp.play_phase(2, true, 5, 60)$$, 'o progresso é por jogador');
select pg_temp.denied($$select * from public.logos_fragmentos$$, 'tabela de fragmentos não é legível direto');
select pg_temp.denied($$insert into public.logos_fragmentos(user_id, phase, reference, best_seconds) values (gen_random_uuid(), 1, 'x', 10)$$, 'não dá para inserir fragmento direto');

-- limite de 30 partidas por hora vale também na campanha
reset role;
insert into public.logos_runs(user_id, mode, kills, seconds) select (select id from camp_fixture where role_name = 'beto'), 'vigilia', 0, 60 from generate_series(1, 30);
select pg_temp.as_user('beto');
select pg_temp.denied($$select pg_temp.play_phase(1, true, 5, 60)$$, 'mais de 30 partidas por hora é barrado');

-- sem login
reset role;
select pg_temp.denied($$set local role anon; select public.logos_campaign()$$, 'anônimo não abre a campanha');
reset role;
select pg_temp.denied($$set local role anon; select public.logos_phase_finish(gen_random_uuid(), true, 5, 60)$$, 'anônimo não registra fase');
reset role;
select count(*) as verificacoes from camp_checks;
rollback;
