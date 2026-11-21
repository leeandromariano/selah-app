begin;

-- CORAM // LOGOS, Modo História: 4 Atos e 16 fases. Cada fase vencida pela primeira vez entrega um Fragmento Bíblico (só a referência;
-- o texto vem do leitor da Bíblia). A fase seguinte só abre depois de a anterior ter o fragmento. Prêmios e desbloqueio são calculados aqui.
alter table public.logos_runs drop constraint logos_runs_mode_check;
alter table public.logos_runs add constraint logos_runs_mode_check check (mode in ('vigilia', 'farol', 'historia'));
alter table public.logos_runs add column phase smallint check (phase between 1 and 16);

create table public.logos_fragmentos (
  user_id uuid not null references auth.users(id) on delete cascade,
  phase smallint not null check (phase between 1 and 16),
  reference text not null,
  obtained_at timestamptz not null default now(),
  clears integer not null default 1 check (clears >= 1),
  best_seconds integer not null check (best_seconds between 5 and 3600),
  primary key (user_id, phase)
);
alter table public.logos_fragmentos enable row level security;
revoke all on public.logos_fragmentos from public, anon, authenticated;

-- Um fragmento por fase, na ordem da campanha.
create function private.logos_fragment_reference(p_phase integer) returns text language sql immutable set search_path = '' as $$
  select (array['Mateus 4:4', 'Isaías 43:2', 'Mateus 4:7', 'Mateus 4:10',
    'Salmos 119:105', 'Salmos 23:1', 'Salmos 23:4', 'Salmos 27:1',
    'Efésios 6:16', 'Romanos 8:1', 'Isaías 54:17', 'Apocalipse 12:10',
    'Mateus 16:24', 'Colossenses 2:15', 'Romanos 8:37', 'João 19:30'])[p_phase]
$$;
revoke all on function private.logos_fragment_reference(integer) from public, anon, authenticated;

create function public.logos_campaign() returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_list jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('phase', f.phase, 'reference', f.reference, 'obtained_at', f.obtained_at, 'clears', f.clears, 'best_seconds', f.best_seconds) order by f.phase), '[]'::jsonb)
    into v_list from public.logos_fragmentos f where f.user_id = v_user;
  return jsonb_build_object('fragments', v_list);
end $$;

-- Fim de fase da campanha. Vitória: fragmento na primeira vez e prêmio cheio; repetir rende 30%. Derrota: prêmio pequeno.
create function public.logos_phase_finish(p_phase integer, p_won boolean, p_kills integer, p_seconds integer) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_sparks integer; v_xp integer; v_recent integer; v_recent_sparks integer; v_repeat boolean := false; v_new boolean := false; v_boss boolean;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_phase is null or p_won is null or p_kills is null or p_seconds is null or p_phase not between 1 and 16 or p_kills not between 0 and 2000 or p_seconds not between 5 and 3600 or p_kills > p_seconds * 5 then raise exception 'Resultado de partida inválido'; end if;
  insert into public.logos_player_progress(user_id) values (v_user) on conflict do nothing;
  perform 1 from public.logos_player_progress where user_id = v_user for update;
  if p_phase > 1 and not exists (select 1 from public.logos_fragmentos where user_id = v_user and phase = p_phase - 1) then raise exception 'Esta fase ainda está bloqueada'; end if;
  select count(*), coalesce(sum(sparks), 0) into v_recent, v_recent_sparks from public.logos_runs where user_id = v_user and created_at > now() - interval '1 hour';
  if v_recent >= 30 then raise exception 'Você jogou muitas partidas seguidas. Respire e volte daqui a pouco'; end if;
  v_boss := p_phase in (4, 7, 12, 16);
  v_repeat := exists (select 1 from public.logos_fragmentos where user_id = v_user and phase = p_phase);
  if p_won then
    v_sparks := 100 + 10 * (p_phase - 1) + case when v_boss then 100 else 0 end;
    v_xp := 60 + 10 * p_phase;
    if v_repeat then v_sparks := v_sparks * 3 / 10; v_xp := v_xp * 3 / 10; end if;
  else
    v_sparks := least(40, p_kills); v_xp := 10;
  end if;
  if v_recent_sparks + v_sparks > 1500 then v_sparks := greatest(0, 1500 - v_recent_sparks); end if;
  insert into public.logos_runs(user_id, mode, wave, kills, seconds, won, sparks, xp, phase) values (v_user, 'historia', 0, p_kills, p_seconds, p_won, v_sparks, v_xp, p_phase);
  if p_won then
    insert into public.logos_fragmentos(user_id, phase, reference, best_seconds) values (v_user, p_phase, private.logos_fragment_reference(p_phase), p_seconds)
      on conflict (user_id, phase) do update set clears = public.logos_fragmentos.clears + 1, best_seconds = least(public.logos_fragmentos.best_seconds, excluded.best_seconds);
    v_new := not v_repeat;
  end if;
  update public.logos_player_progress set sparks = sparks + v_sparks, xp = xp + v_xp, kills_total = kills_total + p_kills, updated_at = now() where user_id = v_user;
  return private.logos_snapshot(v_user) || jsonb_build_object('reward', jsonb_build_object('sparks', v_sparks, 'xp', v_xp),
    'fragment', case when p_won then jsonb_build_object('phase', p_phase, 'reference', private.logos_fragment_reference(p_phase), 'is_new', v_new) else null end);
end $$;

revoke all on function public.logos_campaign(), public.logos_phase_finish(integer, boolean, integer, integer) from public, anon;
grant execute on function public.logos_campaign(), public.logos_phase_finish(integer, boolean, integer, integer) to authenticated;

commit;
