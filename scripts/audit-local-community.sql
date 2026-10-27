-- Aggregate diagnostics only. Never select contacts, usernames, UUIDs or tokens
-- into the result. Classification is evidence, not a permanent identity flag.
begin read only;
set transaction isolation level repeatable read;
with base as (
  select u.id,n.username,
    lower(u.email) ~ '@example[.]invalid$' as reserved_fixture_domain,
    lower(u.email) ~ '^(selah-(reading|consistency|editor|library|test|login|browser|privacy|whatsapp|username|profile)|owner-provision)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@example[.]invalid$' as known_generator_address,
    u.email_confirmed_at is not null as confirmed
  from auth.users u left join public.account_usernames n on n.user_id=u.id
  where u.deleted_at is null and not coalesce(u.is_anonymous,false)
), days as (
  select c.user_id,c.completed_day as day,count(*) as receipts,
    bool_and((c.completed_at at time zone 'America/Sao_Paulo')::time=time '12:00:00') as noon_receipts,
    bool_and(d.id is null) as sources_absent
  from public.devotional_completions c left join public.devotionals d on d.id=c.source_devotional_id
  where c.completed_day<=(clock_timestamp() at time zone 'America/Sao_Paulo')::date
  group by c.user_id,c.completed_day
), grouped as (
  select *,day-(row_number() over(partition by user_id order by day))::integer as run from days
), runs as (
  select user_id,count(*) as length,max(day) as last_day from grouped group by user_id,run
), stats as (
  select user_id,max(length) as best,
    coalesce(max(length) filter(where last_day>=(clock_timestamp() at time zone 'America/Sao_Paulo')::date-1),0) as current
  from runs group by user_id
), receipt_stats as (
  select user_id,count(*) as day_count,sum(receipts) as receipts,bool_and(noon_receipts) as all_noon,
    bool_and(sources_absent) as all_sources_absent,max(day)-min(day) as span,
    max(day)=(clock_timestamp() at time zone 'America/Sao_Paulo')::date as completed_today
  from days group by user_id
), combined as (
  select b.*,coalesce(s.current,0) as current,coalesce(s.best,0) as best,r.*
  from base b left join stats s on s.user_id=b.id left join receipt_stats r on r.user_id=b.id
)
select jsonb_build_object(
  'kind','metrics','server_today',(clock_timestamp() at time zone 'America/Sao_Paulo')::date,
  'total_readers',count(*),'completed_today',count(*) filter(where completed_today),
  'confirmed_accounts',count(*) filter(where confirmed),
  'reserved_fixture_domain_accounts',count(*) filter(where reserved_fixture_domain),
  'known_generator_accounts',count(*) filter(where known_generator_address),
  'unclassified_accounts',count(*) filter(where not coalesce(known_generator_address,false)),
  'generated_username_accounts',count(*) filter(where username ~ '^u[0-9a-f]{20}$'),
  'generated_usernames_with_generator_evidence',count(*) filter(where username ~ '^u[0-9a-f]{20}$' and known_generator_address),
  'generated_usernames_without_generator_evidence',count(*) filter(where username ~ '^u[0-9a-f]{20}$' and not coalesce(known_generator_address,false)),
  'observed_prefix_matches',count(*) filter(where username like 'u8031ded%'),
  'observed_prefix_generator_accounts',count(*) filter(where username like 'u8031ded%' and known_generator_address),
  'accounts_without_username',count(*) filter(where username is null),
  'zero_completion_accounts',count(*) filter(where coalesce(day_count,0)=0),
  'streak_1005_accounts',count(*) filter(where current=1005),
  'streak_1005_generator_accounts',count(*) filter(where current=1005 and known_generator_address),
  'streak_1005_full_signature',count(*) filter(where current=1005 and known_generator_address and reserved_fixture_domain
    and day_count=1005 and receipts=1005 and span=1004 and all_noon and all_sources_absent),
  'streak_1005_completed_today',count(*) filter(where current=1005 and completed_today)
) from combined;

select jsonb_build_object('kind','authorization',
  'owner_count',(select count(*) from private.app_owner),
  'owner_active_confirmed_editorial',exists(select 1 from private.app_owner o join auth.users u on u.id=o.user_id join private.admin_users a on a.user_id=u.id
    where u.email_confirmed_at is not null and u.deleted_at is null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=clock_timestamp())),
  'owner_grant_audited',exists(select 1 from private.app_owner o join private.owner_provision_audit a on a.next_user_id=o.user_id where a.action in ('grant','transfer')),
  'owner_matches_latest_audit',exists(select 1 from private.app_owner o join
    (select action,next_user_id from private.owner_provision_audit order by recorded_at desc,event_id desc limit 1) a on a.next_user_id=o.user_id where a.action in ('grant','transfer')),
  'owner_table_private',not has_table_privilege('authenticated','private.app_owner','select,insert,update,delete'),
  'rpc_security_definer',(select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.get_owner_community(text,integer,integer)'::regprocedure),
  'rpc_source_md5',(select md5(prosrc) from pg_proc where oid='public.get_owner_community(text,integer,integer)'::regprocedure),
  'anon_execute_denied',not has_function_privilege('anon','public.get_owner_community(text,integer,integer)','execute'));

-- Probe the ALREADY configured owner in a READ ONLY transaction. This is not a
-- browser login, token creation, identity selection for promotion or grant.
do $$ begin
  if (select count(*) from private.app_owner)=1 then
    perform set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from private.app_owner),'role','authenticated')::text,true);
  end if;
end $$;
set local role authenticated;
select case when auth.uid() is null then jsonb_build_object('kind','owner_probe','configured_owner_rpc_allowed',false)
else (with probe as materialized (select public.get_owner_community() as snapshot),
  pages as materialized (
    select p,public.get_owner_community('',p,100) as snapshot
    from probe cross join lateral generate_series(0,least(99,greatest(0,((probe.snapshot->>'total_readers')::integer-1)/100))) p
  ), ranked as (
    select r.value,r.ordinality+pages.p*100 as position from pages
    cross join lateral jsonb_array_elements(pages.snapshot->'readers') with ordinality r
  ), ordered as (
    select value,position,lag(value) over(order by position) as previous from ranked
  )
  select jsonb_build_object('kind','owner_probe','configured_owner_rpc_allowed',true,
  'total_readers',snapshot->'total_readers','completed_today',snapshot->'completed_today',
  'page_size',snapshot->'size','returned_rows',jsonb_array_length(snapshot->'readers'),
  'repeated_first_page_stable',snapshot=public.get_owner_community(),
  'pagination_complete',(select count(*) from ranked)=(snapshot->>'total_readers')::integer,
  'descending_streak_and_username_ties',not exists(select 1 from ordered where previous is not null and
    ((previous->>'current_streak')::integer<(value->>'current_streak')::integer or
     ((previous->>'current_streak')::integer=(value->>'current_streak')::integer and
      ((previous->>'username')>(value->>'username') or (previous->>'username' is null and value->>'username' is not null))))),
  'observed_prefix_search_matches',(public.get_owner_community(' U8031DED ')->>'matched_readers')::integer,
  'zero_metrics_consistent',not exists(select 1 from ranked where value->>'status'='empty' and
    ((value->>'current_streak')::integer<>0 or (value->>'best_streak')::integer<>0 or (value->>'total_days')::integer<>0)),
  'streak_record_totals_consistent',not exists(select 1 from ranked where (value->>'current_streak')::integer>(value->>'best_streak')::integer or
    (value->>'best_streak')::integer>(value->>'total_days')::integer),
  'minimal_projection',not exists(select 1 from jsonb_array_elements(snapshot->'readers') r cross join lateral jsonb_object_keys(r) k
    where k not in ('username','current_streak','best_streak','total_days','status')))
  from probe) end;
reset role;
rollback;
