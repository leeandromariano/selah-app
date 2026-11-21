-- CORAM // LOGOS: por enquanto só o OWNER abre partidas ("em breve" para os demais).
-- Toda recompensa passa por uma sessão aberta aqui, então fechar a abertura fecha também o fim de partida.
begin;

create or replace function public.logos_session_start(p_mode text, p_phase integer default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid; v_seed integer; v_at timestamptz;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from private.app_owner where user_id = v_user) then raise exception 'O CORAM // LOGOS chega em breve' using errcode = '42501'; end if;
  if p_mode is null or p_mode not in ('vigilia', 'farol', 'historia') then raise exception 'Resultado de partida inválido'; end if;
  if (p_mode = 'historia') <> (p_phase is not null) or (p_phase is not null and p_phase not between 1 and 16) then raise exception 'Resultado de partida inválido'; end if;
  insert into public.logos_player_progress(user_id) values (v_user) on conflict do nothing;
  perform 1 from public.logos_player_progress where user_id = v_user for update;
  if p_phase is not null and p_phase > 1 and not exists (select 1 from public.logos_fragmentos where user_id = v_user and phase = p_phase - 1) then raise exception 'Esta fase ainda está bloqueada'; end if;
  if (select count(*) from public.logos_sessions where user_id = v_user and started_at > now() - interval '1 hour') >= 40 then raise exception 'Você jogou muitas partidas seguidas. Respire e volte daqui a pouco'; end if;
  insert into public.logos_sessions(user_id, mode, phase) values (v_user, p_mode, p_phase) returning id, seed, started_at into v_id, v_seed, v_at;
  return jsonb_build_object('session_id', v_id, 'seed', v_seed, 'started_at', v_at);
end $$;

revoke all on function public.logos_session_start(text, integer) from public, anon;
grant execute on function public.logos_session_start(text, integer) to authenticated;

commit;
