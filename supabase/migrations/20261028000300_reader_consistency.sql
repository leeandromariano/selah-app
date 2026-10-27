begin;

-- Read aggregation only: no new event, counter, permission to write, or backfill.
create index devotional_completions_user_day_idx
  on public.devotional_completions (user_id, completed_day);

create function public.get_my_consistency(p_month date default null) returns jsonb
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
    select day, case when lag(day) over (order by day)=day-1 then 0 else 1 end as starts_run
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
      coalesce(max(length) filter (where last_day between v_today-1 and v_today),0) as current_streak
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
      when s.last_day=v_today-1 then 'pending_today' else 'interrupted' end,
    'days',c.days)
  into v_result from summary s cross join streaks r cross join calendar c;
  return v_result;
end;
$$;
alter function public.get_my_consistency(date) owner to postgres;
revoke all on function public.get_my_consistency(date) from public,anon,authenticated,service_role;
grant execute on function public.get_my_consistency(date) to authenticated;

commit;
