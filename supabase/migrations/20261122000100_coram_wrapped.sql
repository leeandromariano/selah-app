begin;

-- CORAM Wrapped: o retrato do mês ou do ano de cada leitor, montado na hora a partir do que o app já guarda.
-- Nada novo é gravado e nada sai de quem pediu: só o próprio leitor lê os próprios números (sem ranking, sem comparação).
-- Datas no fuso de Brasília, o mesmo do restante do app.
create function public.get_my_wrapped(p_kind text, p_year integer, p_month integer default null) returns jsonb
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
  ), runs as (
    select count(*) as len from (select d, d - (row_number() over (order by d))::integer as grp from days) s group by grp
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

revoke all on function public.get_my_wrapped(text, integer, integer) from public, anon;
grant execute on function public.get_my_wrapped(text, integer, integer) to authenticated;

commit;
