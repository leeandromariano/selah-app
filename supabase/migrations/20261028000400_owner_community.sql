begin;
-- Deliberately empty. Existing editorial administrators are NOT promoted.
create table private.app_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table private.app_owner enable row level security;
revoke all on private.app_owner from public, anon, authenticated, service_role;

create function public.get_owner_community(p_search text default '', p_page integer default 0, p_size integer default 25)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_search text := lower(btrim(coalesce(p_search,'')));
  v_result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from private.app_owner where user_id=auth.uid()) then
    raise exception 'Owner required' using errcode='42501';
  end if;
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
  ), grouped as (
    select user_id,day,day-(row_number() over(partition by user_id order by day))::integer as run from days
  ), runs as (
    select user_id,count(*) as length,max(day) as last_day from grouped group by user_id,run
  ), metrics as materialized (
    select p.id,p.username,coalesce(sum(r.length),0)::bigint as total_days,
      coalesce(max(r.length),0) as best_streak,
      coalesce(max(r.length) filter(where r.last_day>=v_today-1),0) as current_streak,
      case when max(r.last_day)=v_today then 'completed_today'
        when max(r.last_day)=v_today-1 then 'pending_today'
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
alter function public.get_owner_community(text,integer,integer) owner to postgres;
revoke all on function public.get_owner_community(text,integer,integer) from public, anon, authenticated, service_role;
grant execute on function public.get_owner_community(text,integer,integer) to authenticated;
commit;
