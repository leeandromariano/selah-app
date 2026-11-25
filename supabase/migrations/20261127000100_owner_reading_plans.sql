begin;

-- Painel OWNER: quem está em um plano de leitura e em que porcentagem. Devolve só username, plano, data de início,
-- quantidade de dias marcados e data da última atualização; nunca quais dias ou capítulos, e-mail ou telefone.
-- A tabela continua sem acesso direto: esta função é a única leitura de terceiros e exige o OWNER.
create function public.get_owner_reading_plans(p_search text default '', p_plan text default '', p_page integer default 0, p_size integer default 25)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_plan text := coalesce(p_plan, '');
  v_result jsonb;
begin
  perform private.owner_identity();
  if p_page is null or p_page < 0 or p_page > 1000000 or p_size is null or p_size < 1 or p_size > 100
    or length(v_search) > 24 or v_search !~ '^[a-z0-9_]*$'
    or (v_plan <> '' and private.reading_plan_days(v_plan) is null) then
    raise exception 'Invalid reading plan query' using errcode = '22023';
  end if;
  with enrolled as materialized (
    select e.user_id, e.plan_id, e.started_on, n.username,
      cardinality(e.completed_days) as done_days,
      private.reading_plan_days(e.plan_id) as total_days,
      round(cardinality(e.completed_days) * 100.0 / private.reading_plan_days(e.plan_id))::integer as percent,
      (e.updated_at at time zone 'America/Sao_Paulo')::date as updated_on
    from public.reading_plan_enrollments e
    join auth.users u on u.id = e.user_id and u.deleted_at is null and not coalesce(u.is_anonymous, false)
    left join public.account_usernames n on n.user_id = e.user_id
  ), filtered as materialized (
    select * from enrolled where (v_plan = '' or plan_id = v_plan) and (v_search = '' or strpos(username, v_search) > 0)
  ), page as (
    select username, plan_id as plan, started_on, done_days, total_days, percent, updated_on from filtered
    order by done_days::numeric / total_days desc, username asc nulls last, user_id asc, plan_id asc
    limit p_size offset (p_page::bigint * p_size)
  )
  select jsonb_build_object('server_today', v_today,
    'readers', (select count(distinct user_id) from enrolled),
    'enrollments', (select count(*) from enrolled),
    'finished', (select count(*) from enrolled where done_days >= total_days),
    'plans', coalesce((select jsonb_agg(to_jsonb(s) order by s.plan) from (
      select plan_id as plan, count(*) as enrolled, round(avg(done_days * 100.0 / total_days))::integer as average_percent
      from enrolled group by plan_id) s), '[]'::jsonb),
    'matched', (select count(*) from filtered), 'page', p_page, 'size', p_size,
    'items', coalesce((select jsonb_agg(to_jsonb(page)) from page), '[]'::jsonb)) into v_result;
  return v_result;
end $$;
alter function public.get_owner_reading_plans(text, text, integer, integer) owner to postgres;
revoke all on function public.get_owner_reading_plans(text, text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.get_owner_reading_plans(text, text, integer, integer) to authenticated;

commit;
