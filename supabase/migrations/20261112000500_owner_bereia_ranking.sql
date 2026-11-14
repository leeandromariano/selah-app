begin;

-- Ranking administrativo da Bereia, exclusivo do owner. O quiz bíblico já tem o seu (get_owner_quiz_ranking);
-- este cobre os outros jogos e o ranking geral (quiz + jogos de resposta + dias de Versículo Oculto resolvidos).
-- Conta só a primeira resposta de cada leitor, como nos jogos. Não expõe e-mail nem dados pessoais além do username.
create function public.get_owner_bereia_ranking(p_game text, p_search text default '', p_page integer default 0, p_size integer default 25) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from private.app_owner where user_id = auth.uid()) then
    raise exception 'Owner required' using errcode = '42501';
  end if;
  if p_game is null or p_game not in ('geral', 'claims', 'who', 'timeline', 'verse')
    or p_page is null or p_page < 0 or p_page > 1000000 or p_size is null or p_size < 1 or p_size > 100
    or length(v_search) > 24 or v_search !~ '^[a-z0-9_]*$' then
    raise exception 'Invalid game, pagination or username search' using errcode = '22023';
  end if;
  with raw as (
    select 'quiz'::text as g, user_id, is_correct, answered_at from public.quiz_answers
    union all select 'claims', user_id, is_correct, answered_at from public.claim_answers
    union all select 'who', user_id, is_correct, answered_at from public.who_answers
    union all select 'timeline', user_id, is_correct, answered_at from public.timeline_answers
  ), answers as (
    select user_id, count(*) as answered, count(*) filter (where is_correct) as correct, max(answered_at) as last_at,
      count(distinct g) as games
    from raw where p_game = 'geral' or g = p_game group by user_id
  ), days as (
    select user_id, day, max(attempt_no) as tries, bool_or(solved) as solved, max(created_at) as last_at
    from public.verse_attempts where p_game in ('geral', 'verse') group by user_id, day
  ), verse as (
    select user_id, count(*) as played, count(*) filter (where solved) as solved,
      round(avg(tries) filter (where solved), 1) as avg_attempts, max(last_at) as last_at
    from days group by user_id
  ), metrics as materialized (
    select coalesce(a.user_id, v.user_id) as user_id, n.username,
      coalesce(a.answered, 0) as answered, coalesce(a.correct, 0) as correct,
      coalesce(v.played, 0) as played, coalesce(v.solved, 0) as solved, v.avg_attempts,
      coalesce(a.games, 0) + case when coalesce(v.played, 0) > 0 then 1 else 0 end as games_played,
      coalesce(a.correct, 0) + coalesce(v.solved, 0) as score,
      greatest(a.last_at, v.last_at) as last_at
    from answers a
    full join verse v on v.user_id = a.user_id
    join auth.users u on u.id = coalesce(a.user_id, v.user_id) and u.deleted_at is null
    left join public.account_usernames n on n.user_id = coalesce(a.user_id, v.user_id)
  ), filtered as materialized (
    select * from metrics where v_search = '' or strpos(coalesce(username, ''), v_search) > 0
  ), page as (
    select username, answered, correct, played, solved, avg_attempts, games_played, score, last_at,
      case when answered > 0 then round(100.0 * correct / answered)::integer else 0 end as accuracy
    from filtered
    order by case when p_game = 'verse' then solved else score end desc,
      case when p_game = 'verse' then coalesce(avg_attempts, 99) else answered end asc,
      username asc nulls last, user_id asc
    limit p_size offset (p_page::bigint * p_size)
  )
  select jsonb_build_object('game', p_game, 'total_players', (select count(*) from metrics), 'matched_players', (select count(*) from filtered),
    'total_items', case p_game
      when 'claims' then (select count(*) from public.claim_cards where active)
      when 'who' then (select count(*) from public.who_cards where active)
      when 'timeline' then (select count(*) from public.timeline_events where active)
      when 'verse' then (select count(*) from public.verse_puzzles where active)
      else 0 end,
    'page', p_page, 'size', p_size,
    'players', coalesce((select jsonb_agg(to_jsonb(page)) from page), '[]'::jsonb)) into v_result;
  return v_result;
end $$;

alter function public.get_owner_bereia_ranking(text, text, integer, integer) owner to postgres;
revoke all on function public.get_owner_bereia_ranking(text, text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.get_owner_bereia_ranking(text, text, integer, integer) to authenticated;

commit;
