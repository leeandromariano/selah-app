begin;

-- CORAM // LOGOS (Bereia): progresso do jogador, armadura de Efésios 6 e histórico de partidas.
-- Ninguém lê nem escreve as tabelas diretamente: tudo passa por funções security definer que usam auth.uid().
-- As Centelhas só mudam aqui no servidor: a partida informa o resultado e o servidor limita o prêmio.
create table public.logos_player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sparks integer not null default 0 check (sparks >= 0),
  xp integer not null default 0 check (xp >= 0),
  vigilia_best_wave smallint not null default 0 check (vigilia_best_wave between 0 and 200),
  vigilia_runs integer not null default 0 check (vigilia_runs >= 0),
  farol_runs integer not null default 0 check (farol_runs >= 0),
  farol_wins integer not null default 0 check (farol_wins >= 0),
  kills_total integer not null default 0 check (kills_total >= 0),
  updated_at timestamptz not null default now()
);
alter table public.logos_player_progress enable row level security;
revoke all on public.logos_player_progress from public, anon, authenticated;

create table public.logos_armadura (
  user_id uuid not null references auth.users(id) on delete cascade,
  piece text not null check (piece in ('cinturao', 'coraca', 'sandalias', 'escudo', 'capacete', 'espada')),
  level smallint not null default 1 check (level between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, piece)
);
alter table public.logos_armadura enable row level security;
revoke all on public.logos_armadura from public, anon, authenticated;

create table public.logos_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('vigilia', 'farol')),
  wave smallint not null default 0 check (wave between 0 and 200),
  kills integer not null check (kills between 0 and 2000),
  seconds integer not null check (seconds between 5 and 3600),
  won boolean not null default false,
  sparks integer not null default 0,
  xp integer not null default 0,
  created_at timestamptz not null default now()
);
create index logos_runs_user_idx on public.logos_runs (user_id, created_at desc);
alter table public.logos_runs enable row level security;
revoke all on public.logos_runs from public, anon, authenticated;

-- Estado completo do jogador (Centelhas, nível, recordes e nível de cada peça da armadura; peça sem registro está no nível 1).
create function private.logos_snapshot(p_user uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'sparks', p.sparks, 'xp', p.xp, 'level', 1 + p.xp / 300,
    'vigilia_best_wave', p.vigilia_best_wave, 'vigilia_runs', p.vigilia_runs,
    'farol_runs', p.farol_runs, 'farol_wins', p.farol_wins, 'kills_total', p.kills_total,
    'armadura', (select jsonb_object_agg(piece.name, coalesce(a.level, 1))
      from unnest(array['cinturao', 'coraca', 'sandalias', 'escudo', 'capacete', 'espada']) as piece(name)
      left join public.logos_armadura a on a.user_id = p.user_id and a.piece = piece.name))
  from public.logos_player_progress p where p.user_id = p_user
$$;
revoke all on function private.logos_snapshot(uuid) from public, anon, authenticated;

create function public.logos_lobby() returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.logos_player_progress(user_id) values (v_user) on conflict do nothing;
  return private.logos_snapshot(v_user);
end $$;

-- Aprimorar uma peça custa 100 Centelhas vezes o nível atual (1→2: 100, 2→3: 200, 3→4: 300, 4→5: 400).
create function public.logos_armadura_upgrade(p_piece text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_level integer; v_cost integer; v_sparks integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_piece is null or p_piece not in ('cinturao', 'coraca', 'sandalias', 'escudo', 'capacete', 'espada') then raise exception 'Peça de armadura inválida'; end if;
  insert into public.logos_player_progress(user_id) values (v_user) on conflict do nothing;
  select sparks into v_sparks from public.logos_player_progress where user_id = v_user for update;
  select level into v_level from public.logos_armadura where user_id = v_user and piece = p_piece;
  v_level := coalesce(v_level, 1);
  if v_level >= 5 then raise exception 'Esta peça já está no nível máximo'; end if;
  v_cost := 100 * v_level;
  if v_sparks < v_cost then raise exception 'Centelhas insuficientes'; end if;
  update public.logos_player_progress set sparks = sparks - v_cost, updated_at = now() where user_id = v_user;
  insert into public.logos_armadura(user_id, piece, level) values (v_user, p_piece, v_level + 1)
    on conflict (user_id, piece) do update set level = excluded.level, updated_at = now();
  return private.logos_snapshot(v_user);
end $$;

-- Fim de partida. O servidor limita o prêmio, confere se o resultado é plausível e freia exageros (30 partidas e 1500 Centelhas por hora).
create function public.logos_run_finish(p_mode text, p_wave integer, p_kills integer, p_seconds integer, p_won boolean) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_sparks integer; v_xp integer; v_recent integer; v_recent_sparks integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_mode is null or p_mode not in ('vigilia', 'farol') or p_wave is null or p_kills is null or p_seconds is null or p_won is null then raise exception 'Resultado de partida inválido'; end if;
  if p_wave not between 0 and 200 or p_kills not between 0 and 2000 or p_seconds not between 5 and 3600 or p_kills > p_seconds * 5 then raise exception 'Resultado de partida inválido'; end if;
  if p_mode = 'farol' and p_wave <> 0 then raise exception 'Resultado de partida inválido'; end if;
  if p_mode = 'vigilia' and p_won then raise exception 'Resultado de partida inválido'; end if;
  insert into public.logos_player_progress(user_id) values (v_user) on conflict do nothing;
  perform 1 from public.logos_player_progress where user_id = v_user for update;
  select count(*), coalesce(sum(sparks), 0) into v_recent, v_recent_sparks from public.logos_runs where user_id = v_user and created_at > now() - interval '1 hour';
  if v_recent >= 30 then raise exception 'Você jogou muitas partidas seguidas. Respire e volte daqui a pouco'; end if;
  if p_mode = 'vigilia' then
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
  insert into public.logos_runs(user_id, mode, wave, kills, seconds, won, sparks, xp) values (v_user, p_mode, p_wave, p_kills, p_seconds, p_won, v_sparks, v_xp);
  update public.logos_player_progress set
    sparks = sparks + v_sparks, xp = xp + v_xp, kills_total = kills_total + p_kills, updated_at = now(),
    vigilia_runs = vigilia_runs + case when p_mode = 'vigilia' then 1 else 0 end,
    vigilia_best_wave = case when p_mode = 'vigilia' then greatest(vigilia_best_wave, p_wave)::smallint else vigilia_best_wave end,
    farol_runs = farol_runs + case when p_mode = 'farol' then 1 else 0 end,
    farol_wins = farol_wins + case when p_mode = 'farol' and p_won then 1 else 0 end
  where user_id = v_user;
  return private.logos_snapshot(v_user) || jsonb_build_object('reward', jsonb_build_object('sparks', v_sparks, 'xp', v_xp));
end $$;

revoke all on function public.logos_lobby(), public.logos_armadura_upgrade(text), public.logos_run_finish(text, integer, integer, integer, boolean) from public, anon;
grant execute on function public.logos_lobby(), public.logos_armadura_upgrade(text), public.logos_run_finish(text, integer, integer, integer, boolean) to authenticated;

commit;
