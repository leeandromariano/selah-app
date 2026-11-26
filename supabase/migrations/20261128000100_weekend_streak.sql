begin;

-- Constância: sábado e domingo sem devocional não zeram a sequência; quando o leitor conclui, o dia soma.
-- Vale para a sequência atual, o recorde, os marcos, o painel do OWNER e a retrospectiva. Tudo é calculado na leitura:
-- nenhuma conclusão é criada ou alterada. Os jogos da Bereia têm contagem própria e não mudam.

-- Verdadeiro quando, entre um dia concluído e o seguinte (ou hoje), não ficou nenhum dia de segunda a sexta sem conclusão.
create function private.keeps_streak(p_from date, p_to date) returns boolean
language sql immutable set search_path = '' as $$
  select case when p_from is null or p_to is null or p_to < p_from or p_to - p_from > 3 then false
    else not exists (select 1 from generate_series(1, p_to - p_from - 1) g(n) where extract(isodow from p_from + g.n) < 6) end
$$;
alter function private.keeps_streak(date, date) owner to postgres;
revoke all on function private.keeps_streak(date, date) from public, anon, authenticated, service_role;
-- get_my_consistency roda com as permissões de quem consulta; a função só compara duas datas, sem ler tabelas.
grant execute on function private.keeps_streak(date, date) to authenticated;

create or replace function public.get_my_consistency(p_month date default null) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_today date := (v_now at time zone 'America/Sao_Paulo')::date;
  v_current_month date := date_trunc('month', v_today::timestamp)::date;
  v_month date := coalesce(p_month, v_current_month);
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  -- This is a calendar selection, NEVER a supplied completion date or "today".
  if v_month < date '0001-01-01' or v_month > date '9999-12-01' or extract(day from v_month) <> 1 then
    raise exception 'Invalid calendar month' using errcode='22023';
  end if;
  -- One SQL snapshot for all totals and calendar cells. Existing RLS also applies,
  -- including to administrators. Keep deleted/unpublished content receipts: no join.
  with per_day as materialized (
    select c.completed_day as day, count(*) as completions
    from public.devotional_completions c
    where c.user_id=v_user and c.completed_day <= v_today
    group by c.completed_day
  ), starts as (
    select day, case when private.keeps_streak(lag(day) over (order by day), day) then 0 else 1 end as starts_run
    from per_day
  ), grouped as (
    select day, sum(starts_run) over (order by day) as run_id from starts
  ), runs as (
    select count(*) as length, max(day) as last_day from grouped group by run_id
  ), summary as (
    select count(*) as total_days, coalesce(sum(completions),0) as total_devotionals,
      min(day) as first_day, max(day) as last_day,
      coalesce(bool_or(day=v_today),false) as today_completed
    from per_day
  ), streaks as (
    select coalesce(max(length),0) as best_streak,
      coalesce(max(length) filter (where private.keeps_streak(last_day, v_today)),0) as current_streak
    from runs
  ), calendar as (
    select jsonb_agg(jsonb_build_object('date',d.day::date,
      'completions',coalesce(p.completions,0)) order by d.day) as days
    from generate_series(v_month::timestamp,
      (v_month+interval '1 month'-interval '1 day')::timestamp,interval '1 day') d(day)
    left join per_day p on p.day=d.day::date
  )
  select jsonb_build_object(
    'server_now',v_now,'server_today',v_today,'time_zone','America/Sao_Paulo',
    'month',v_month,'current_month',v_current_month,
    'first_month',coalesce(date_trunc('month',s.first_day::timestamp)::date,v_current_month),
    'current_streak',r.current_streak,'best_streak',r.best_streak,
    'today_completed',s.today_completed,'total_days',s.total_days,
    'total_devotionals',s.total_devotionals,'last_completed_day',s.last_day,
    'status',case when s.total_days=0 then 'empty'
      when s.today_completed then 'completed_today'
      when private.keeps_streak(s.last_day, v_today) then 'pending_today' else 'interrupted' end,
    'days',c.days)
  into v_result from summary s cross join streaks r cross join calendar c;
  return v_result;
end;
$$;

create or replace function public.get_owner_community(p_search text default '', p_page integer default 0, p_size integer default 25)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_search text := lower(btrim(coalesce(p_search,'')));
  v_result jsonb;
begin
  perform private.owner_identity();
  if p_page is null or p_page < 0 or p_page > 1000000 or p_size is null or p_size < 1 or p_size > 100
    or length(v_search)>24 or v_search !~ '^[a-z0-9_]*$' then
    raise exception 'Invalid pagination or username search' using errcode='22023';
  end if;
  with participants as materialized (
    select u.id, n.username from auth.users u left join public.account_usernames n on n.user_id=u.id
    where u.deleted_at is null and not coalesce(u.is_anonymous,false)
  ), days as (
    select c.user_id,c.completed_day as day from public.devotional_completions c
    join participants p on p.id=c.user_id where c.completed_day<=v_today group by c.user_id,c.completed_day
  ), starts as (
    select user_id,day,case when private.keeps_streak(lag(day) over(partition by user_id order by day),day) then 0 else 1 end as starts_run from days
  ), grouped as (
    select user_id,day,sum(starts_run) over(partition by user_id order by day) as run from starts
  ), runs as (
    select user_id,count(*) as length,max(day) as last_day from grouped group by user_id,run
  ), metrics as materialized (
    select p.id,p.username,coalesce(sum(r.length),0)::bigint as total_days,
      coalesce(max(r.length),0) as best_streak,
      coalesce(max(r.length) filter(where private.keeps_streak(r.last_day,v_today)),0) as current_streak,
      case when max(r.last_day)=v_today then 'completed_today'
        when private.keeps_streak(max(r.last_day),v_today) then 'pending_today'
        when max(r.last_day) is null then 'empty' else 'interrupted' end as status
    from participants p left join runs r on r.user_id=p.id group by p.id,p.username
  ), filtered as materialized (
    select * from metrics where v_search='' or strpos(username,v_search)>0
  ), page as (
    select username,current_streak,best_streak,total_days,status from filtered
    order by current_streak desc,username asc nulls last,id asc limit p_size offset (p_page::bigint*p_size)
  )
  select jsonb_build_object('server_today',v_today,'time_zone','America/Sao_Paulo',
    'total_readers',(select count(*) from metrics),
    'completed_today',(select count(*) from metrics where status='completed_today'),
    'matched_readers',(select count(*) from filtered),'page',p_page,'size',p_size,
    'readers',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb)) into v_result;
  return v_result;
end $$;

create or replace function public.get_owner_dashboard(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_from date;
  v_result jsonb;
begin
  perform private.owner_identity();
  if p_days is null or p_days not in (1, 7, 30, 90) then raise exception 'Invalid period' using errcode = '22023'; end if;
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
      select s.user_id, s.day, sum(s.starts_run) over (partition by s.user_id order by s.day) as run from (
        select d.user_id, d.day, case when private.keeps_streak(lag(d.day) over (partition by d.user_id order by d.day), d.day) then 0 else 1 end as starts_run
        from (select distinct user_id, day from comp) d) s) g group by user_id, run
  ), streaks as (
    select p.id, coalesce(max(r.length) filter (where private.keeps_streak(r.last_day, v_today)), 0) as current_streak, coalesce(max(r.length), 0) as best
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

create or replace function public.get_my_wrapped(p_kind text, p_year integer, p_month integer default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_start date;
  v_end date; -- primeiro dia depois do período
  v_days integer;
  v_completed integer;
  v_streak integer;
  v_books jsonb;
  v_games jsonb;
  v_verse jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('month', 'year') or p_year is null or p_year not between 2025 and 2100
    or (p_kind = 'month' and (p_month is null or p_month not between 1 and 12)) or (p_kind = 'year' and p_month is not null) then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;
  if p_kind = 'month' then
    v_start := make_date(p_year, p_month, 1); v_end := (v_start + interval '1 month')::date;
  else
    v_start := make_date(p_year, 1, 1); v_end := make_date(p_year + 1, 1, 1);
  end if;
  if v_start > v_today then raise exception 'Este período ainda não começou.' using errcode = '22023'; end if;

  -- dias na Presença: dias distintos com devocional concluído, e a maior sequência seguida dentro do período
  with days as (
    select distinct c.completed_day as d from public.devotional_completions c
    where c.user_id = v_user and c.completed_day >= v_start and c.completed_day < v_end
  ), starts as (
    select d, case when private.keeps_streak(lag(d) over (order by d), d) then 0 else 1 end as starts_run from days
  ), runs as (
    select count(*) as len from (select sum(starts_run) over (order by d) as grp from starts) s group by grp
  )
  select (select count(*) from days), coalesce((select max(len) from runs), 0) into v_days, v_streak;
  select count(*) into v_completed from public.devotional_completions c
    where c.user_id = v_user and c.completed_day >= v_start and c.completed_day < v_end;

  -- livros mais lidos: devocionais abertos ou concluídos no período, agrupados pelo livro da passagem
  with read_ids as (
    select c.source_devotional_id as id from public.devotional_completions c
      where c.user_id = v_user and c.completed_day >= v_start and c.completed_day < v_end
    union
    select w.devotional_id from public.devotional_views w
      where w.user_id = v_user and (w.opened_at at time zone 'America/Sao_Paulo')::date >= v_start and (w.opened_at at time zone 'America/Sao_Paulo')::date < v_end
  ), keyed as (
    select coalesce(d.bible_selection ->> 'book', lower(btrim(regexp_replace(d.bible_reference, '\s+[0-9].*$', '')))) as key
    from read_ids r join public.devotionals d on d.id = r.id
  )
  select coalesce(jsonb_agg(jsonb_build_object('key', k.key, 'count', k.n) order by k.n desc, k.key), '[]'::jsonb) into v_books
  from (select key, count(*) as n from keyed where key is not null and key <> '' group by key order by count(*) desc, key limit 12) k;

  -- Bereia: acertos e respostas em cada jogo, só dentro do período
  with g as (
    select 'quiz' as game, count(*) as answered, count(*) filter (where is_correct) as correct from public.quiz_answers
      where user_id = v_user and (answered_at at time zone 'America/Sao_Paulo')::date >= v_start and (answered_at at time zone 'America/Sao_Paulo')::date < v_end
    union all
    select 'mito', count(*), count(*) filter (where is_correct) from public.claim_answers
      where user_id = v_user and (answered_at at time zone 'America/Sao_Paulo')::date >= v_start and (answered_at at time zone 'America/Sao_Paulo')::date < v_end
    union all
    select 'quem-disse', count(*), count(*) filter (where is_correct) from public.who_answers
      where user_id = v_user and (answered_at at time zone 'America/Sao_Paulo')::date >= v_start and (answered_at at time zone 'America/Sao_Paulo')::date < v_end
    union all
    select 'linha-do-tempo', count(*), count(*) filter (where is_correct) from public.timeline_answers
      where user_id = v_user and (answered_at at time zone 'America/Sao_Paulo')::date >= v_start and (answered_at at time zone 'America/Sao_Paulo')::date < v_end
    union all
    select 'versiculo', count(distinct day), count(distinct day) filter (where solved) from public.verse_attempts
      where user_id = v_user and day >= v_start and day < v_end
  )
  select coalesce(jsonb_agg(jsonb_build_object('game', game, 'answered', answered, 'correct', correct) order by game), '[]'::jsonb) into v_games from g;

  -- versículo mais revisitado: o devocional aberto mais vezes no período (a partir de 2 aberturas)
  select jsonb_build_object('reference', d.bible_reference, 'title', d.title, 'opens', t.n) into v_verse
  from (select w.devotional_id, count(*) as n, max(w.opened_at) as last_open from public.devotional_views w
        where w.user_id = v_user and (w.opened_at at time zone 'America/Sao_Paulo')::date >= v_start and (w.opened_at at time zone 'America/Sao_Paulo')::date < v_end
        group by w.devotional_id having count(*) >= 2 order by count(*) desc, max(w.opened_at) desc limit 1) t
  join public.devotionals d on d.id = t.devotional_id;

  return jsonb_build_object('kind', p_kind, 'year', p_year, 'month', p_month, 'start', v_start, 'end', v_end - 1, 'partial', v_end > v_today,
    'presence', jsonb_build_object('days', v_days, 'completed', v_completed, 'longest_streak', v_streak),
    'books', v_books,
    'bereia', jsonb_build_object('games', v_games),
    'verse', v_verse);
end $$;

commit;
