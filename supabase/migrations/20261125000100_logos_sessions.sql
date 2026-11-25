-- CORAM // LOGOS: partidas com sessão. O servidor abre a sessão (hora de início) e só aceita o fim de partida
-- se a sessão for do jogador, estiver aberta e o tempo bater com o relógio do servidor. Cada sessão vale uma vez.
begin;

create table public.logos_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('vigilia', 'farol', 'historia')),
  phase smallint check (phase between 1 and 16),
  seed integer not null default (floor(random() * 2147483647))::integer,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  check ((mode = 'historia') = (phase is not null))
);
create index logos_sessions_user_idx on public.logos_sessions (user_id, started_at desc);
alter table public.logos_sessions enable row level security;
revoke all on public.logos_sessions from public, anon, authenticated;

alter table public.logos_runs add column session_id uuid unique references public.logos_sessions(id) on delete set null;

-- Abre uma partida. Fase da campanha só abre se a anterior foi vencida; no máximo 40 aberturas por hora.
create function public.logos_session_start(p_mode text, p_phase integer default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid; v_seed integer; v_at timestamptz;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_mode is null or p_mode not in ('vigilia', 'farol', 'historia') then raise exception 'Resultado de partida inválido'; end if;
  if (p_mode = 'historia') <> (p_phase is not null) or (p_phase is not null and p_phase not between 1 and 16) then raise exception 'Resultado de partida inválido'; end if;
  insert into public.logos_player_progress(user_id) values (v_user) on conflict do nothing;
  perform 1 from public.logos_player_progress where user_id = v_user for update;
  if p_phase is not null and p_phase > 1 and not exists (select 1 from public.logos_fragmentos where user_id = v_user and phase = p_phase - 1) then raise exception 'Esta fase ainda está bloqueada'; end if;
  if (select count(*) from public.logos_sessions where user_id = v_user and started_at > now() - interval '1 hour') >= 40 then raise exception 'Você jogou muitas partidas seguidas. Respire e volte daqui a pouco'; end if;
  insert into public.logos_sessions(user_id, mode, phase) values (v_user, p_mode, p_phase) returning id, seed, started_at into v_id, v_seed, v_at;
  return jsonb_build_object('session_id', v_id, 'seed', v_seed, 'started_at', v_at);
end $$;

-- Fecha a sessão e devolve o que vale: modo, fase e os segundos limitados pelo relógio do servidor.
create function private.logos_session_close(p_session uuid, p_user uuid, p_seconds integer, out o_mode text, out o_phase integer, out o_seconds integer) language plpgsql security definer set search_path = '' as $$
declare v_row public.logos_sessions; v_elapsed numeric;
begin
  if p_session is null or p_seconds is null then raise exception 'Partida inválida ou expirada'; end if;
  select * into v_row from public.logos_sessions where id = p_session and user_id = p_user for update;
  if not found or v_row.finished_at is not null then raise exception 'Partida inválida ou expirada'; end if;
  v_elapsed := extract(epoch from now() - v_row.started_at);
  if v_elapsed > 7200 then raise exception 'Partida inválida ou expirada'; end if;
  if p_seconds not between 5 and 3600 or p_seconds > v_elapsed + 3 or v_elapsed < 5 then raise exception 'Resultado de partida inválido'; end if;
  update public.logos_sessions set finished_at = now() where id = p_session;
  o_mode := v_row.mode; o_phase := v_row.phase; o_seconds := least(p_seconds, floor(v_elapsed)::integer);
end $$;
revoke all on function private.logos_session_close(uuid, uuid, integer) from public, anon, authenticated;

drop function public.logos_run_finish(text, integer, integer, integer, boolean);
drop function public.logos_phase_finish(integer, boolean, integer, integer);

-- Fim de partida rápida (Vigília ou Farol). O modo vem da sessão, não do cliente.
create function public.logos_run_finish(p_session uuid, p_wave integer, p_kills integer, p_seconds integer, p_won boolean) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_mode text; v_phase integer; v_secs integer; v_sparks integer; v_xp integer; v_recent integer; v_recent_sparks integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_wave is null or p_kills is null or p_won is null then raise exception 'Resultado de partida inválido'; end if;
  insert into public.logos_player_progress(user_id) values (v_user) on conflict do nothing;
  perform 1 from public.logos_player_progress where user_id = v_user for update;
  select o_mode, o_phase, o_seconds into v_mode, v_phase, v_secs from private.logos_session_close(p_session, v_user, p_seconds);
  if v_mode not in ('vigilia', 'farol') then raise exception 'Resultado de partida inválido'; end if;
  if p_wave not between 0 and 200 or p_kills not between 0 and 2000 or p_kills > v_secs * 5 then raise exception 'Resultado de partida inválido'; end if;
  if v_mode = 'farol' and (p_wave <> 0 or (p_won and v_secs < 40)) then raise exception 'Resultado de partida inválido'; end if;
  if v_mode = 'vigilia' and (p_won or p_wave > v_secs / 5 + 1) then raise exception 'Resultado de partida inválido'; end if;
  select count(*), coalesce(sum(sparks), 0) into v_recent, v_recent_sparks from public.logos_runs where user_id = v_user and created_at > now() - interval '1 hour';
  if v_recent >= 30 then raise exception 'Você jogou muitas partidas seguidas. Respire e volte daqui a pouco'; end if;
  if v_mode = 'vigilia' then
    v_sparks := least(300, p_wave * 15 + p_kills * 2);
    v_xp := least(300, p_wave * 10 + p_kills);
  elsif p_won then
    v_sparks := least(250, 150 + p_kills * 2);
    v_xp := 120;
  else
    v_sparks := least(80, 30 + p_kills);
    v_xp := 25;
  end if;
  if v_recent_sparks + v_sparks > 1500 then v_sparks := greatest(0, 1500 - v_recent_sparks); end if;
  insert into public.logos_runs(user_id, mode, wave, kills, seconds, won, sparks, xp, session_id) values (v_user, v_mode, p_wave, p_kills, v_secs, p_won, v_sparks, v_xp, p_session);
  update public.logos_player_progress set
    sparks = sparks + v_sparks, xp = xp + v_xp, kills_total = kills_total + p_kills, updated_at = now(),
    vigilia_runs = vigilia_runs + case when v_mode = 'vigilia' then 1 else 0 end,
    vigilia_best_wave = case when v_mode = 'vigilia' then greatest(vigilia_best_wave, p_wave)::smallint else vigilia_best_wave end,
    farol_runs = farol_runs + case when v_mode = 'farol' then 1 else 0 end,
    farol_wins = farol_wins + case when v_mode = 'farol' and p_won then 1 else 0 end
  where user_id = v_user;
  return private.logos_snapshot(v_user) || jsonb_build_object('reward', jsonb_build_object('sparks', v_sparks, 'xp', v_xp));
end $$;

-- Fim de fase da campanha. A fase vem da sessão. Vitória: fragmento na primeira vez e prêmio cheio; repetir rende 30%.
create function public.logos_phase_finish(p_session uuid, p_won boolean, p_kills integer, p_seconds integer) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_mode text; v_phase integer; v_secs integer; v_sparks integer; v_xp integer; v_recent integer; v_recent_sparks integer; v_repeat boolean := false; v_new boolean := false; v_boss boolean; v_min integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_won is null or p_kills is null then raise exception 'Resultado de partida inválido'; end if;
  insert into public.logos_player_progress(user_id) values (v_user) on conflict do nothing;
  perform 1 from public.logos_player_progress where user_id = v_user for update;
  select o_mode, o_phase, o_seconds into v_mode, v_phase, v_secs from private.logos_session_close(p_session, v_user, p_seconds);
  if v_mode <> 'historia' or p_kills not between 0 and 2000 or p_kills > v_secs * 5 then raise exception 'Resultado de partida inválido'; end if;
  v_boss := v_phase in (4, 7, 12, 16);
  v_min := case when v_boss then 60 else 20 end;
  if p_won and v_secs < v_min then raise exception 'Resultado de partida inválido'; end if;
  if v_phase > 1 and not exists (select 1 from public.logos_fragmentos where user_id = v_user and phase = v_phase - 1) then raise exception 'Esta fase ainda está bloqueada'; end if;
  select count(*), coalesce(sum(sparks), 0) into v_recent, v_recent_sparks from public.logos_runs where user_id = v_user and created_at > now() - interval '1 hour';
  if v_recent >= 30 then raise exception 'Você jogou muitas partidas seguidas. Respire e volte daqui a pouco'; end if;
  v_repeat := exists (select 1 from public.logos_fragmentos where user_id = v_user and phase = v_phase);
  if p_won then
    v_sparks := 100 + 10 * (v_phase - 1) + case when v_boss then 100 else 0 end;
    v_xp := 60 + 10 * v_phase;
    if v_repeat then v_sparks := v_sparks * 3 / 10; v_xp := v_xp * 3 / 10; end if;
  else
    v_sparks := least(40, p_kills); v_xp := 10;
  end if;
  if v_recent_sparks + v_sparks > 1500 then v_sparks := greatest(0, 1500 - v_recent_sparks); end if;
  insert into public.logos_runs(user_id, mode, wave, kills, seconds, won, sparks, xp, phase, session_id) values (v_user, 'historia', 0, p_kills, v_secs, p_won, v_sparks, v_xp, v_phase, p_session);
  if p_won then
    insert into public.logos_fragmentos(user_id, phase, reference, best_seconds) values (v_user, v_phase, private.logos_fragment_reference(v_phase), v_secs)
      on conflict (user_id, phase) do update set clears = public.logos_fragmentos.clears + 1, best_seconds = least(public.logos_fragmentos.best_seconds, excluded.best_seconds);
    v_new := not v_repeat;
  end if;
  update public.logos_player_progress set sparks = sparks + v_sparks, xp = xp + v_xp, kills_total = kills_total + p_kills, updated_at = now() where user_id = v_user;
  return private.logos_snapshot(v_user) || jsonb_build_object('reward', jsonb_build_object('sparks', v_sparks, 'xp', v_xp),
    'fragment', case when p_won then jsonb_build_object('phase', v_phase, 'reference', private.logos_fragment_reference(v_phase), 'is_new', v_new) else null end);
end $$;

revoke all on function public.logos_session_start(text, integer), public.logos_run_finish(uuid, integer, integer, integer, boolean), public.logos_phase_finish(uuid, boolean, integer, integer) from public, anon;
grant execute on function public.logos_session_start(text, integer), public.logos_run_finish(uuid, integer, integer, integer, boolean), public.logos_phase_finish(uuid, boolean, integer, integer) to authenticated;

commit;
