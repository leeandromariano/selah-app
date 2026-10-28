begin;
-- New data only; no backfill, reading change, membership or OWNER grant.
create table private.discussion_comments (
  id uuid primary key default gen_random_uuid(),
  devotional_id uuid not null references public.devotionals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check(length(body)<=1000),
  state text not null check(state in ('pending','approved','rejected','hidden','removed')),
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(devotional_id,user_id),
  check((state='removed' and body='') or (state<>'removed' and length(btrim(body))>0))
);
create index discussion_comments_queue on private.discussion_comments(state,updated_at,id);
create table private.discussion_reactions (
  devotional_id uuid not null references public.devotionals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value text not null check(value in ('like','dislike')),
  primary key(devotional_id,user_id)
);
create table private.discussion_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references private.discussion_comments(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  reason text not null check(reason in ('contact','harassment','threat','exposure','spam','other')),
  created_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  unique(comment_id,reporter_id,version)
);
create index discussion_reports_open on private.discussion_reports(comment_id) where resolved_at is null;
create table private.discussion_audit (
  id bigint generated always as identity primary key,
  comment_id uuid not null references private.discussion_comments(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  version integer not null,
  reason text,
  created_at timestamptz not null default clock_timestamp()
);
create index discussion_audit_comment on private.discussion_audit(comment_id,id desc);
create table private.discussion_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  bucket timestamptz not null,
  uses integer not null check(uses>0),
  primary key(user_id,kind,bucket)
);
alter table private.discussion_comments enable row level security;
alter table private.discussion_reactions enable row level security;
alter table private.discussion_reports enable row level security;
alter table private.discussion_audit enable row level security;
alter table private.discussion_limits enable row level security;
revoke all on private.discussion_comments,private.discussion_reactions,private.discussion_reports,private.discussion_audit,private.discussion_limits from public,anon,authenticated,service_role;
revoke all on sequence private.discussion_audit_id_seq from public,anon,authenticated,service_role;

create function private.discussion_identity() returns uuid language plpgsql stable set search_path='' as $$
declare who uuid:=auth.uid();begin
  if who is null or not exists(select 1 from auth.users where id=who and deleted_at is null
    and email_confirmed_at is not null and not coalesce(is_anonymous,false)
    and (banned_until is null or banned_until<=clock_timestamp())) then
    raise exception 'Active account required' using errcode='42501';end if;
  return who;
end $$;
create function private.discussion_owner() returns uuid language plpgsql stable set search_path='' as $$
declare who uuid:=private.discussion_identity();begin
  if not exists(select 1 from private.app_owner where user_id=who) then raise exception 'Owner required' using errcode='42501';end if;
  return who;
end $$;
create function private.discussion_publication(p_id uuid) returns void language plpgsql set search_path='' as $$
begin
  -- SHARE lock serializes with withdrawal/deletion, without changing a column.
  perform 1 from public.devotionals where id=p_id and status='published' and publish_at<=clock_timestamp() for share;
  if not found then raise exception 'Publication unavailable' using errcode='42501';end if;
end $$;
create function private.discussion_limit(p_who uuid,p_kind text) returns void language plpgsql set search_path='' as $$
declare cap integer;bucket_at timestamptz;used integer;begin
  cap:=case p_kind when 'comment' then 5 when 'reaction' then 60 when 'report' then 5 when 'moderation' then 120 end;
  if cap is null then raise exception 'Invalid limiter';end if;
  bucket_at:=to_timestamp(floor(extract(epoch from clock_timestamp())/(case when p_kind='report' then 86400 else 3600 end))*(case when p_kind='report' then 86400 else 3600 end));
  insert into private.discussion_limits(user_id,kind,bucket,uses) values(p_who,p_kind,bucket_at,1)
    on conflict(user_id,kind,bucket) do update set uses=discussion_limits.uses+1 returning uses into used;
  if used>cap then raise exception 'Please wait before trying again' using errcode='P0429';end if;
end $$;

create function public.get_devotional_discussion(p_devotional uuid,p_page integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=private.discussion_identity();result jsonb;begin
  perform private.discussion_publication(p_devotional);
  if p_page is null or p_page<0 or p_page>10000 then raise exception 'Invalid page' using errcode='22023';end if;
  select jsonb_build_object('reaction',(select value from private.discussion_reactions where user_id=who and devotional_id=p_devotional),
    'own',(select jsonb_build_object('id',id,'body',body,'state',state,'version',version) from private.discussion_comments where user_id=who and devotional_id=p_devotional),
    'page',p_page,'total',(select count(*) from private.discussion_comments c join public.account_usernames n on n.user_id=c.user_id where devotional_id=p_devotional and state='approved'),
    'comments',coalesce((select jsonb_agg(v) from (
      select c.id,c.body,n.username,(c.updated_at at time zone 'America/Sao_Paulo')::date as day,
        c.user_id=who as own,
        exists(select 1 from private.discussion_reports r where r.comment_id=c.id and r.reporter_id=who and r.version=c.version) as reported
      from private.discussion_comments c join public.account_usernames n on n.user_id=c.user_id
      where c.devotional_id=p_devotional and c.state='approved'
      order by c.updated_at desc,c.id desc limit 20 offset p_page*20
    ) v),'[]'::jsonb)) into result;
  -- Individual reactions and aggregate vote totals remain private in v1.
  return result;
end $$;
create function public.set_my_devotional_reaction(p_devotional uuid,p_value text) returns void
language plpgsql security definer set search_path='' as $$
declare who uuid:=private.discussion_identity();old_value text;begin
  perform pg_advisory_xact_lock(hashtextextended(who::text,2234));
  perform private.discussion_publication(p_devotional);
  if p_value is not null and p_value not in ('like','dislike') then raise exception 'Invalid reaction' using errcode='22023';end if;
  select value into old_value from private.discussion_reactions where user_id=who and devotional_id=p_devotional;
  if old_value is not distinct from p_value then return;end if;
  perform private.discussion_limit(who,'reaction');
  if p_value is null then delete from private.discussion_reactions where user_id=who and devotional_id=p_devotional;
  else insert into private.discussion_reactions(devotional_id,user_id,value) values(p_devotional,who,p_value)
    on conflict(devotional_id,user_id) do update set value=excluded.value;end if;
end $$;
create function public.save_my_devotional_comment(p_devotional uuid,p_body text,p_version integer default 0) returns void
language plpgsql security definer set search_path='' as $$
declare who uuid:=private.discussion_identity();c private.discussion_comments%rowtype;content text:=btrim(p_body);begin
  perform pg_advisory_xact_lock(hashtextextended(who::text,2234));
  perform private.discussion_publication(p_devotional);
  if content is null or length(content)<1 or length(content)>1000 or content ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' then raise exception 'Invalid reflection' using errcode='22023';end if;
  if not exists(select 1 from public.account_usernames where user_id=who) then raise exception 'Username required' using errcode='42501';end if;
  select * into c from private.discussion_comments where user_id=who and devotional_id=p_devotional for update;
  -- Desired-state retry is idempotent, including a response lost after commit.
  if found and c.body=content and c.state<>'removed' then return;end if;
  if p_version is null or (c.id is null and p_version<>0) or (c.id is not null and p_version<>c.version) then raise exception 'Reflection changed; reload' using errcode='40001';end if;
  perform private.discussion_limit(who,'comment');
  if c.id is null then
    insert into private.discussion_comments(devotional_id,user_id,body,state) values(p_devotional,who,content,'pending') returning * into c;
  else
    update private.discussion_comments set body=content,state='pending',version=version+1,updated_at=clock_timestamp() where id=c.id returning * into c;
    update private.discussion_reports set resolved_at=clock_timestamp() where comment_id=c.id and resolved_at is null;
  end if;
  insert into private.discussion_audit(comment_id,actor_id,action,version) values(c.id,who,'submit',c.version);
end $$;
create function public.remove_my_devotional_comment(p_devotional uuid,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare who uuid:=private.discussion_identity();c private.discussion_comments%rowtype;begin
  perform pg_advisory_xact_lock(hashtextextended(who::text,2234));
  -- Erasure is allowed even after publication is withdrawn, without a spam limit.
  select * into c from private.discussion_comments where user_id=who and devotional_id=p_devotional for update;
  if c.id is null or c.state='removed' then return;end if;
  if p_version is null or p_version<>c.version then raise exception 'Reflection changed; reload' using errcode='40001';end if;
  update private.discussion_comments set body='',state='removed',version=version+1,updated_at=clock_timestamp() where id=c.id returning * into c;
  update private.discussion_reports set resolved_at=clock_timestamp() where comment_id=c.id and resolved_at is null;
  insert into private.discussion_audit(comment_id,actor_id,action,version) values(c.id,who,'remove',c.version);
end $$;
create function public.report_devotional_comment(p_comment uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare who uuid:=private.discussion_identity();c private.discussion_comments%rowtype;begin
  perform pg_advisory_xact_lock(hashtextextended(who::text,2234));
  select * into c from private.discussion_comments where id=p_comment;
  if c.id is null then raise exception 'Comment unavailable' using errcode='42501';end if;
  perform private.discussion_publication(c.devotional_id);
  select * into c from private.discussion_comments where id=p_comment for update;
  if c.state<>'approved' or c.user_id=who then raise exception 'Comment unavailable' using errcode='42501';end if;
  if p_reason is null or p_reason not in ('contact','harassment','threat','exposure','spam','other') then raise exception 'Invalid reason' using errcode='22023';end if;
  if exists(select 1 from private.discussion_reports where comment_id=c.id and reporter_id=who and version=c.version) then return;end if;
  perform private.discussion_limit(who,'report');
  insert into private.discussion_reports(comment_id,reporter_id,version,reason) values(c.id,who,c.version,p_reason);
end $$;

create function public.get_my_discussion_access() returns boolean
language plpgsql security definer stable set search_path='' as $$
declare who uuid:=private.discussion_identity();begin return exists(select 1 from private.app_owner where user_id=who);end $$;
create function public.get_owner_discussion(p_queue text default 'pending',p_page integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=private.discussion_owner();result jsonb;begin
  if p_queue is null or p_queue not in ('pending','reports','history') or p_page is null or p_page<0 or p_page>10000 then raise exception 'Invalid queue' using errcode='22023';end if;
  if p_queue='history' then
    return jsonb_build_object('queue',p_queue,'page',p_page,'total',(select count(*) from private.discussion_audit),
      'items',coalesce((select jsonb_agg(v) from (
        select a.id,a.action,a.reason,a.version,(a.created_at at time zone 'America/Sao_Paulo')::date as day,
          n.username as actor,d.title as title
        from private.discussion_audit a join private.discussion_comments c on c.id=a.comment_id
        join public.devotionals d on d.id=c.devotional_id left join public.account_usernames n on n.user_id=a.actor_id
        order by a.id desc limit 20 offset p_page*20
      ) v),'[]'::jsonb));
  end if;
  select jsonb_build_object('queue',p_queue,'page',p_page,'total',(select count(*) from private.discussion_comments c
      where (p_queue='pending' and c.state='pending') or (p_queue='reports' and exists(select 1 from private.discussion_reports r where r.comment_id=c.id and r.resolved_at is null))),
    'items',coalesce((select jsonb_agg(v) from (
      select c.id,c.body,c.state,c.version,n.username,(c.updated_at at time zone 'America/Sao_Paulo')::date as day,
        d.title,d.status='published' and d.publish_at<=clock_timestamp() as available,
        coalesce((select jsonb_agg(jsonb_build_object('reason',r.reason,'day',(r.created_at at time zone 'America/Sao_Paulo')::date)) from private.discussion_reports r where r.comment_id=c.id and r.resolved_at is null),'[]'::jsonb) as reports
      from private.discussion_comments c join public.devotionals d on d.id=c.devotional_id left join public.account_usernames n on n.user_id=c.user_id
      where (p_queue='pending' and c.state='pending') or (p_queue='reports' and exists(select 1 from private.discussion_reports r where r.comment_id=c.id and r.resolved_at is null))
      order by c.updated_at,c.id limit 20 offset p_page*20
    ) v),'[]'::jsonb)) into result;
  return result;
end $$;
create function public.moderate_devotional_comment(p_comment uuid,p_version integer,p_action text,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare who uuid:=private.discussion_owner();c private.discussion_comments%rowtype;target text;begin
  perform pg_advisory_xact_lock(hashtextextended(who::text,2234));
  select * into c from private.discussion_comments where id=p_comment;
  if c.id is null then raise exception 'Comment unavailable' using errcode='42501';end if;
  if p_action='approve' then perform private.discussion_publication(c.devotional_id);end if;
  select * into c from private.discussion_comments where id=p_comment for update;
  target:=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' when 'hide' then 'hidden' end;
  if target is null or p_reason is null or p_reason not in ('reviewed','contact','harassment','threat','exposure','spam','other')
    or (p_action<>'approve' and p_reason='reviewed') then raise exception 'Invalid decision' using errcode='22023';end if;
  if c.state=target and p_version=c.version-1 then return;end if;
  if p_version is null or p_version<>c.version then raise exception 'Reflection changed; reload' using errcode='40001';end if;
  if c.state='removed' or (p_action='reject' and c.state<>'pending') or (p_action='hide' and c.state<>'approved')
    or (p_action='approve' and c.state not in ('pending','hidden','rejected','approved')) then raise exception 'Invalid transition' using errcode='22023';end if;
  perform private.discussion_limit(who,'moderation');
  update private.discussion_comments set state=target,version=version+1,updated_at=clock_timestamp() where id=c.id returning * into c;
  update private.discussion_reports set resolved_at=clock_timestamp() where comment_id=c.id and resolved_at is null;
  insert into private.discussion_audit(comment_id,actor_id,action,version,reason) values(c.id,who,p_action,c.version,p_reason);
end $$;
create function private.cleanup_discussion(p_now timestamptz default clock_timestamp()) returns void
language plpgsql set search_path='' as $$
begin
  delete from private.discussion_limits where bucket<p_now-interval '2 days';
  delete from private.discussion_reports where resolved_at<p_now-interval '30 days' or created_at<p_now-interval '90 days';
  delete from private.discussion_audit where created_at<p_now-interval '90 days';
  -- Keep uniqueness/version tombstones; erase sensitive text after 30 days off public view.
  update private.discussion_comments set body='',state='removed',version=version+1,updated_at=p_now
    where state in ('pending','hidden','rejected') and updated_at<p_now-interval '30 days';
end $$;
do $$declare r record;begin
  for r in select p.oid::regprocedure signature,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='private' and p.proname in ('discussion_identity','discussion_owner','discussion_publication','discussion_limit','cleanup_discussion'))
      or (n.nspname='public' and p.proname in ('get_devotional_discussion','set_my_devotional_reaction','save_my_devotional_comment','remove_my_devotional_comment','report_devotional_comment','get_my_discussion_access','get_owner_discussion','moderate_devotional_comment'))
  loop
    execute format('alter function %s owner to postgres',r.signature);
    execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
    if r.nspname='public' then execute format('grant execute on function %s to authenticated',r.signature);end if;
  end loop;
end $$;
commit;
