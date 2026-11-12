begin;

-- Dashboard do OWNER: indicadores agregados (sem textos de leitores, pedidos de oração, respostas pessoais, e-mail ou
-- telefone). Uma única consulta devolve todas as áreas para o período escolhido (7, 30 ou 90 dias, fuso de São Paulo).
create function public.get_owner_dashboard(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_from date;
  v_result jsonb;
begin
  perform private.owner_identity();
  if p_days is null or p_days not in (7, 30, 90) then raise exception 'Invalid period' using errcode = '22023'; end if;
  v_from := v_today - (p_days - 1);
  with
  participants as materialized (
    select u.id, (u.created_at at time zone 'America/Sao_Paulo')::date as joined
    from auth.users u where u.deleted_at is null and not coalesce(u.is_anonymous, false)
  ), span as (select generate_series(v_from, v_today, interval '1 day')::date as day),
  comp as materialized (
    select c.user_id, c.completed_day as day from public.devotional_completions c join participants p on p.id = c.user_id where c.completed_day <= v_today
  ), views as materialized (
    select w.user_id, (w.opened_at at time zone 'America/Sao_Paulo')::date as day, w.devotional_id
    from public.devotional_views w join participants p on p.id = w.user_id
  ), plays as materialized (
    select 'quiz'::text as game, a.user_id, (a.answered_at at time zone 'America/Sao_Paulo')::date as day, a.is_correct from public.quiz_answers a
    union all select 'claims', a.user_id, (a.answered_at at time zone 'America/Sao_Paulo')::date, a.is_correct from public.claim_answers a
    union all select 'who', a.user_id, (a.answered_at at time zone 'America/Sao_Paulo')::date, a.is_correct from public.who_answers a
    union all select 'timeline', a.user_id, (a.answered_at at time zone 'America/Sao_Paulo')::date, a.is_correct from public.timeline_answers a
  ), vplays as materialized (
    select t.user_id, t.day, bool_or(t.solved) as solved from public.verse_attempts t group by t.user_id, t.day
  ), active as (
    select user_id from comp where day >= v_from union select user_id from views where day >= v_from
    union select user_id from plays where day >= v_from union select user_id from vplays where day >= v_from
  ), runs as (
    select user_id, count(*) as length, max(day) as last_day from (
      select d.user_id, d.day, d.day - (row_number() over (partition by d.user_id order by d.day))::integer as run
      from (select distinct user_id, day from comp) d) g group by user_id, run
  ), streaks as (
    select p.id, coalesce(max(r.length) filter (where r.last_day >= v_today - 1), 0) as current_streak, coalesce(max(r.length), 0) as best
    from participants p left join runs r on r.user_id = p.id group by p.id
  )
  select jsonb_build_object(
    'server_today', v_today, 'days', p_days,
    'readers', jsonb_build_object(
      'total', (select count(*) from participants),
      'new_in_period', (select count(*) from participants where joined >= v_from),
      'active_in_period', (select count(*) from active a join participants p on p.id = a.user_id),
      'completed_today', (select count(distinct user_id) from comp where day = v_today),
      'best_streak', (select coalesce(max(best), 0) from streaks),
      'streak_buckets', jsonb_build_array(
        jsonb_build_object('label', 'Sem sequência', 'n', (select count(*) from streaks where current_streak = 0)),
        jsonb_build_object('label', '1 a 6 dias', 'n', (select count(*) from streaks where current_streak between 1 and 6)),
        jsonb_build_object('label', '7 a 29 dias', 'n', (select count(*) from streaks where current_streak between 7 and 29)),
        jsonb_build_object('label', '30 dias ou mais', 'n', (select count(*) from streaks where current_streak >= 30))),
      'daily_new', (select jsonb_agg(jsonb_build_object('day', s.day, 'n', (select count(*) from participants p where p.joined = s.day)) order by s.day) from span s)),
    'reading', jsonb_build_object(
      'completions', (select count(*) from comp where day >= v_from),
      'views', (select count(*) from views where day >= v_from),
      'daily_completions', (select jsonb_agg(jsonb_build_object('day', s.day, 'n', (select count(*) from comp c where c.day = s.day)) order by s.day) from span s),
      'daily_views', (select jsonb_agg(jsonb_build_object('day', s.day, 'n', (select count(*) from views w where w.day = s.day)) order by s.day) from span s),
      'devotionals', jsonb_build_object(
        'published', (select count(*) from public.devotionals where status = 'published'),
        'scheduled', (select count(*) from public.devotionals where status = 'scheduled'),
        'draft', (select count(*) from public.devotionals where status = 'draft')),
      'top', coalesce((select jsonb_agg(t) from (
        select d.title, (select count(*) from views w where w.devotional_id = d.id and w.day >= v_from) as views,
          (select count(*) from public.devotional_completions c join participants p on p.id = c.user_id where c.devotional_id = d.id and c.completed_day >= v_from) as completions
        from public.devotionals d where d.status = 'published'
        order by completions desc, views desc, d.publish_at desc limit 5) t), '[]'::jsonb)),
    'games', jsonb_build_object(
      'per_game', (
        select jsonb_agg(g order by g->>'id') from (
          select jsonb_build_object('id', x.game, 'players', count(distinct x.user_id), 'answers', count(*), 'correct', count(*) filter (where x.is_correct)) as g
          from plays x where x.day >= v_from group by x.game
          union all select jsonb_build_object('id', 'verse', 'players', count(distinct v.user_id), 'answers', count(*), 'correct', count(*) filter (where v.solved))
          from vplays v where v.day >= v_from) q),
      'daily', (select jsonb_agg(jsonb_build_object('day', s.day, 'n', (select count(*) from plays x where x.day = s.day) + (select count(*) from vplays v where v.day = s.day)) order by s.day) from span s),
      'players', (select count(distinct u) from (select user_id as u from plays where day >= v_from union select user_id from vplays where day >= v_from) z)),
    'community', jsonb_build_object(
      'approved', (select count(*) from private.discussion_comments where state = 'approved'),
      'approved_in_period', (select count(*) from private.discussion_comments where state = 'approved' and (created_at at time zone 'America/Sao_Paulo')::date >= v_from),
      'pending', (select count(*) from private.discussion_comments where state = 'pending'),
      'open_reports', (select count(*) from private.discussion_reports where resolved_at is null),
      'reactions', (select count(*) from private.discussion_reactions),
      'daily_comments', (select jsonb_agg(jsonb_build_object('day', s.day, 'n', (select count(*) from private.discussion_comments c where c.state = 'approved' and (c.created_at at time zone 'America/Sao_Paulo')::date = s.day)) order by s.day) from span s)),
    'content', jsonb_build_object(
      'quiz', (select count(*) from public.quiz_questions where active),
      'quiz_levels', (select jsonb_agg(jsonb_build_object('level', l, 'n', (select count(*) from public.quiz_questions q where q.active and q.level = l)) order by l) from generate_series(1, 4) l),
      'who', (select count(*) from public.who_cards where active),
      'claims', (select count(*) from public.claim_cards where active),
      'verse', (select count(*) from public.verse_puzzles where active),
      'timeline', (select count(*) from public.timeline_events where active))
  ) into v_result;
  return v_result;
end $$;

alter function public.get_owner_dashboard(integer) owner to postgres;
revoke all on function public.get_owner_dashboard(integer) from public, anon, authenticated, service_role;
grant execute on function public.get_owner_dashboard(integer) to authenticated;

commit;
