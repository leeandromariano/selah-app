begin;

-- Only voluntary enrollment is stored. Completion receipts remain authoritative.
create table private.personal_challenges (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start)=1),
  target smallint not null check (target in (3,5,7)),
  started_at timestamptz not null default clock_timestamp(),
  cancelled_at timestamptz,
  primary key(user_id,week_start)
);
alter table private.personal_challenges enable row level security;
revoke all on private.personal_challenges from public,anon,authenticated,service_role;
create policy personal_challenges_own on private.personal_challenges
  for select to authenticated using (user_id=(select auth.uid()));

create function private.journey_identity() returns uuid
language plpgsql security definer set search_path = '' as $$
declare who uuid := auth.uid();
begin
  if who is null or not exists(select 1 from auth.users u where u.id=who
    and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
    and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp())) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  return who;
end $$;
alter function private.journey_identity() owner to postgres;
revoke all on function private.journey_identity() from public,anon,authenticated,service_role;

create function public.get_my_journey_rewards() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  who uuid := private.journey_identity();
  today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  summary jsonb := public.get_my_consistency();
  result jsonb;
begin
  select jsonb_build_object('server_today',today,'time_zone','America/Sao_Paulo',
    'week_start',today-(extract(isodow from today)::int-1),
    'badges',(select jsonb_agg(jsonb_build_object('days',n,'unlocked',
      (summary->>'best_streak')::bigint>=n) order by n) from unnest(array[3,7,14,30,60,100]) n),
    'challenges',coalesce((select jsonb_agg(jsonb_build_object(
      'week_start',c.week_start,'target',c.target,'days',c.days,
      'status',case when c.cancelled_at is not null then 'cancelled'
        when c.days>=c.target then 'completed' when c.week_start+6<today then 'ended' else 'active' end)
      order by c.week_start desc) from (
      select p.*, (select count(distinct d.completed_day) from public.devotional_completions d
        where d.user_id=who and d.completed_day between p.week_start and least(p.week_start+6,today)
        and (p.cancelled_at is null or d.completed_at<=p.cancelled_at)) as days
      from private.personal_challenges p where p.user_id=who order by p.week_start desc limit 52
    ) c),'[]'::jsonb)) into result;
  return result;
end $$;
alter function public.get_my_journey_rewards() owner to postgres;
revoke all on function public.get_my_journey_rewards() from public,anon,authenticated,service_role;
grant execute on function public.get_my_journey_rewards() to authenticated;

create function public.start_my_personal_challenge(p_target integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare who uuid := private.journey_identity();
  today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  monday date := today-(extract(isodow from today)::int-1);
  existing smallint;
begin
  if p_target is null or p_target not in (3,5,7) then raise exception 'Invalid target' using errcode='22023'; end if;
  -- Unique index serializes concurrent starts; retries never change an enrollment.
  insert into private.personal_challenges(user_id,week_start,target) values(who,monday,p_target)
    on conflict(user_id,week_start) do nothing;
  select target into existing from private.personal_challenges where user_id=who and week_start=monday;
  if existing<>p_target then raise exception 'Weekly challenge already chosen' using errcode='40001'; end if;
  return public.get_my_journey_rewards();
end $$;
alter function public.start_my_personal_challenge(integer) owner to postgres;
revoke all on function public.start_my_personal_challenge(integer) from public,anon,authenticated,service_role;
grant execute on function public.start_my_personal_challenge(integer) to authenticated;

create function public.cancel_my_personal_challenge() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare who uuid := private.journey_identity();
  today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  monday date := today-(extract(isodow from today)::int-1);
begin
  -- Cancellation cannot erase an earned result or affect completion receipts.
  update private.personal_challenges p set cancelled_at=clock_timestamp()
    where p.user_id=who and p.week_start=monday and p.cancelled_at is null
    and (select count(distinct d.completed_day) from public.devotional_completions d
      where d.user_id=who and d.completed_day between monday and today)<p.target;
  return public.get_my_journey_rewards();
end $$;
alter function public.cancel_my_personal_challenge() owner to postgres;
revoke all on function public.cancel_my_personal_challenge() from public,anon,authenticated,service_role;
grant execute on function public.cancel_my_personal_challenge() to authenticated;

commit;
