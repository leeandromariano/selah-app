begin;

-- No backfill, automatic opt-in, change to reading receipts, or OWNER grant.
create table public.reminder_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.reminder_preferences enable row level security;
revoke all on public.reminder_preferences from public,anon,authenticated,service_role;
grant select on public.reminder_preferences to authenticated;
create policy reminder_preferences_own on public.reminder_preferences for select to authenticated
  using (user_id=(select auth.uid()));

create table private.push_configuration (
  singleton boolean primary key default true check(singleton),
  mode text not null default 'simulation' check(mode in ('simulation','webpush')),
  vapid_public_key text check(vapid_public_key ~ '^[A-Za-z0-9_-]{87}$')
);
insert into private.push_configuration(singleton) values(true);
create table private.push_devices (
  device_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  secret_hash bytea not null,
  session_id uuid,
  binding uuid not null default gen_random_uuid(),
  mode text not null check(mode in ('simulation','webpush')),
  state text not null check(state in ('inactive','pending','active','revoked','expired')),
  permission text not null check(permission in ('default','granted','denied','unavailable')),
  local_time time not null,
  timezone text not null,
  next_due_at timestamptz,
  endpoint text unique,
  p256dh text,
  auth_key text,
  expires_at timestamptz,
  proof uuid,
  proof_attempted_at timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);
create index push_devices_due_idx on private.push_devices(next_due_at) where state='active';
create table private.reminder_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references private.push_devices(device_id) on delete cascade,
  binding uuid not null,
  brt_day date not null,
  local_day date not null,
  status text not null check(status in ('reserved','dispatching','simulated','accepted','failed','uncertain','expired','cancelled','unavailable')),
  kind text check(kind in ('reading','share')),
  devotional_id uuid,
  reserved_at timestamptz not null,
  attempted_at timestamptz,
  unique(user_id,device_id,brt_day),
  unique(user_id,device_id,local_day)
);
alter table private.push_configuration enable row level security;
alter table private.push_devices enable row level security;
alter table private.reminder_attempts enable row level security;
revoke all on private.push_configuration,private.push_devices,private.reminder_attempts from public,anon,authenticated,service_role;

-- Earliest occurrence of a repeated local minute; first existing minute at or
-- after a skipped minute. A wholly skipped civil date returns NULL. Computed on
-- registration/rescheduling, not for every device on every scheduler poll.
create function private.reminder_due_at(p_day date,p_time time,p_zone text) returns timestamptz
language sql stable set search_path='' as $$
  select instant from generate_series(
    ((p_day+p_time) at time zone p_zone)-interval '26 hours',
    ((p_day+p_time) at time zone p_zone)+interval '26 hours',interval '1 minute') instant
  where (instant at time zone p_zone)::date=p_day
    and (instant at time zone p_zone)>=(p_day+p_time)
  order by (instant at time zone p_zone),instant limit 1;
$$;
create function private.reminder_next_due(p_time time,p_zone text,p_now timestamptz) returns timestamptz
language plpgsql stable set search_path='' as $$
declare v_due timestamptz; i integer;
begin
  for i in 0..3 loop
    v_due:=private.reminder_due_at((p_now at time zone p_zone)::date+i,p_time,p_zone);
    if v_due>p_now then return v_due;end if;
  end loop;
  raise exception 'Unable to schedule' using errcode='22023';
end $$;

create function public.get_my_reminders(p_device uuid default null,p_secret text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_device private.push_devices%rowtype;v_last jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501';end if;
  select * into v_device from private.push_devices where device_id=p_device and user_id=v_user
    and secret_hash=extensions.digest(coalesce(p_secret,''),'sha256');
  if found then
    select jsonb_build_object('kind',kind,'status',status,'brt_day',brt_day,'local_day',local_day,'at',coalesce(attempted_at,reserved_at))
      into v_last from private.reminder_attempts where device_id=v_device.device_id and user_id=v_user order by reserved_at desc limit 1;
  end if;
  return jsonb_build_object('enabled',coalesce((select enabled from public.reminder_preferences where user_id=v_user),false),
    'mode',(select mode from private.push_configuration),'vapid_public_key',(select vapid_public_key from private.push_configuration),
    'device',case when v_device.device_id is null then null else jsonb_build_object('id',v_device.device_id,'binding',v_device.binding,
      'mode',v_device.mode,'state',v_device.state,'permission',v_device.permission,'time',to_char(v_device.local_time,'HH24:MI'),
      'timezone',v_device.timezone,'expires_at',v_device.expires_at) end,'last',v_last);
end $$;

create function public.save_my_reminders(p_device uuid,p_secret text,p_enabled boolean,p_time text,p_timezone text,
  p_permission text,p_subscription jsonb default null,p_simulated boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_row private.push_devices%rowtype;v_time time;v_mode text;v_endpoint text;
begin
  if v_user is null or not exists(select 1 from auth.users where id=v_user and deleted_at is null and not coalesce(is_anonymous,false)
    and email_confirmed_at is not null and (banned_until is null or banned_until<=clock_timestamp())) then
    raise exception 'Active authenticated account required' using errcode='42501';end if;
  if p_device is null or p_secret is null or p_secret !~ '^[A-Za-z0-9_-]{43}$' or p_enabled is null
    or p_time is null or p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or p_timezone is null or not exists(select 1 from pg_timezone_names where name=p_timezone and (position('/' in name)>0 or name='UTC'))
    or p_permission is null or p_permission not in ('default','granted','denied','unavailable') or p_simulated is null then
    raise exception 'Invalid settings' using errcode='22023';end if;
  v_time:=p_time::time;
  -- Serializes registrations (including an absent device and the device limit).
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,2233));
  select * into v_row from private.push_devices where device_id=p_device for update;
  if found and (v_row.user_id<>v_user or v_row.secret_hash<>extensions.digest(p_secret,'sha256')) then
    raise exception 'Device ownership required' using errcode='42501';end if;
  if not found and (select count(*) from private.push_devices where user_id=v_user)>=10 then
    raise exception 'Device limit' using errcode='22023';end if;
  v_mode:=case when p_simulated then 'simulation' else 'webpush' end;
  if not p_simulated and p_subscription is not null and auth.jwt()->>'session_id' is null then
    raise exception 'Auth session required' using errcode='42501';end if;
  if p_subscription is not null then
    if p_permission<>'granted' then raise exception 'Permission required' using errcode='42501';end if;
    v_endpoint:=p_subscription->>'endpoint';
    if v_endpoint is null or length(v_endpoint)>2048 or p_subscription->'keys'->>'p256dh' is null
      or p_subscription->'keys'->>'p256dh' !~ '^[A-Za-z0-9_-]{87}$'
      or p_subscription->'keys'->>'auth' is null or p_subscription->'keys'->>'auth' !~ '^[A-Za-z0-9_-]{22}$'
      or (p_simulated and v_endpoint !~ '^https://push.test.invalid/[A-Za-z0-9_-]{8,200}$')
      or (not p_simulated and v_endpoint !~ '^https://(fcm.googleapis.com|updates.push.services.mozilla.com|web.push.apple.com|[a-z0-9-]+\.notify.windows.com)/[A-Za-z0-9_/?=+.%~-]+$')
      or (not p_simulated and not exists(select 1 from private.push_configuration where mode='webpush' and vapid_public_key is not null)) then
      raise exception 'Subscription unavailable or invalid' using errcode='22023';end if;
    if exists(select 1 from private.push_devices where endpoint=v_endpoint and device_id<>p_device) then
      raise exception 'Subscription already bound' using errcode='42501';end if;
  end if;
  insert into public.reminder_preferences(user_id,enabled) values(v_user,p_enabled)
    on conflict(user_id) do update set enabled=excluded.enabled,updated_at=clock_timestamp();
  if v_row.device_id is null then
    insert into private.push_devices(device_id,user_id,secret_hash,mode,state,permission,local_time,timezone)
      values(p_device,v_user,extensions.digest(p_secret,'sha256'),v_mode,'inactive',p_permission,v_time,p_timezone);
  end if;
  update private.push_devices set local_time=v_time,timezone=p_timezone,permission=p_permission,
    session_id=nullif(auth.jwt()->>'session_id','')::uuid,
    next_due_at=private.reminder_next_due(v_time,p_timezone,clock_timestamp()),updated_at=clock_timestamp()
    where device_id=p_device;
  if p_permission<>'granted' then
    update private.push_devices set state='revoked',endpoint=null,p256dh=null,auth_key=null,proof=null where device_id=p_device;
  elsif p_subscription is not null then
    update private.push_devices set endpoint=v_endpoint,p256dh=p_subscription->'keys'->>'p256dh',auth_key=p_subscription->'keys'->>'auth',
      mode=v_mode,state=case when p_simulated then 'active' else 'pending' end,binding=gen_random_uuid(),
      proof=case when p_simulated then null else gen_random_uuid() end,proof_attempted_at=null,
      expires_at=least(clock_timestamp()+interval '90 days',coalesce(to_timestamp((p_subscription->>'expirationTime')::numeric/1000),clock_timestamp()+interval '90 days'))
      where device_id=p_device;
  end if;
  return public.get_my_reminders(p_device,p_secret);
end $$;

create function public.revoke_my_push_device(p_device uuid,p_secret text) returns void
language plpgsql security definer set search_path='' as $$
begin
  update private.push_devices set state='revoked',permission='default',endpoint=null,p256dh=null,auth_key=null,proof=null,updated_at=clock_timestamp()
    where device_id=p_device and user_id=auth.uid() and secret_hash=extensions.digest(coalesce(p_secret,''),'sha256');
  if not found then raise exception 'Device ownership required' using errcode='42501';end if;
end $$;
create function public.confirm_my_push_device(p_device uuid,p_secret text,p_proof uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update private.push_devices set state='active',proof=null,updated_at=clock_timestamp()
    where device_id=p_device and user_id=auth.uid() and secret_hash=extensions.digest(coalesce(p_secret,''),'sha256')
      and state='pending' and proof=p_proof and proof_attempted_at>clock_timestamp()-interval '10 minutes';
  if not found then raise exception 'Device proof required' using errcode='42501';end if;
end $$;

create function private.claim_reminders(p_now timestamptz default clock_timestamp(),p_limit integer default 100,p_mode text default 'simulation') returns setof uuid
language plpgsql set search_path='' as $$
declare d private.push_devices%rowtype;v_id uuid;v_local date;v_day date:=(p_now at time zone 'America/Sao_Paulo')::date;
begin
  if p_limit is null or p_limit<1 or p_limit>100 or p_mode is null or p_mode not in ('simulation','webpush') then raise exception 'Invalid batch';end if;
  update private.reminder_attempts set status='uncertain' where status in ('reserved','dispatching') and reserved_at<p_now-interval '2 minutes';
  for d in select x.* from private.push_devices x join public.reminder_preferences p using(user_id)
    join auth.users u on u.id=x.user_id
    where x.state='active' and x.mode=p_mode and x.permission='granted' and p.enabled and x.next_due_at<=p_now
      and u.deleted_at is null and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
      and (u.banned_until is null or u.banned_until<=p_now)
      and ((x.session_id is null and x.mode='simulation') or exists(select 1 from auth.sessions s where s.id=x.session_id and s.user_id=x.user_id and (s.not_after is null or s.not_after>p_now)))
    order by x.next_due_at,x.device_id limit p_limit for update of x skip locked
  loop
    update private.push_devices set next_due_at=private.reminder_next_due(d.local_time,d.timezone,p_now) where device_id=d.device_id;
    if d.expires_at<=p_now then
      update private.push_devices set state='expired',endpoint=null,p256dh=null,auth_key=null where device_id=d.device_id;continue;
    end if;
    if p_now-d.next_due_at>=interval '15 minutes' then continue;end if;
    v_local:=(d.next_due_at at time zone d.timezone)::date;
    v_id:=null;
    insert into private.reminder_attempts(user_id,device_id,binding,brt_day,local_day,status,reserved_at)
      values(d.user_id,d.device_id,d.binding,v_day,v_local,'reserved',p_now)
      on conflict do nothing returning id into v_id;
    if v_id is not null then return next v_id;end if;
  end loop;
end $$;

-- Final authoritative check, immediately before ONE transport attempt. Decision
-- is never stored in the browser. Claims are burned on uncertain outcomes.
create function private.prepare_reminder(p_id uuid,p_now timestamptz default clock_timestamp()) returns jsonb
language plpgsql set search_path='' as $$
declare j private.reminder_attempts%rowtype;d private.push_devices%rowtype;v_content uuid;v_kind text;
begin
  select * into j from private.reminder_attempts where id=p_id for update;
  if not found or j.status<>'reserved' then return null;end if;
  select * into d from private.push_devices where device_id=j.device_id for update;
  if j.reserved_at<p_now-interval '2 minutes' or j.brt_day<>(p_now at time zone 'America/Sao_Paulo')::date
    or d.state<>'active' or d.permission<>'granted' or d.binding<>j.binding or d.expires_at<=p_now
    or not ((d.session_id is null and d.mode='simulation') or exists(select 1 from auth.sessions s where s.id=d.session_id and s.user_id=d.user_id and (s.not_after is null or s.not_after>p_now)))
    or not coalesce((select enabled from public.reminder_preferences where user_id=j.user_id),false)
    or not exists(select 1 from auth.users where id=j.user_id and deleted_at is null and email_confirmed_at is not null
      and not coalesce(is_anonymous,false) and (banned_until is null or banned_until<=p_now)) then
    update private.reminder_attempts set status='cancelled' where id=p_id;return null;
  end if;
  select id into v_content from public.devotionals where status='published' and publish_at<=p_now
    and (publish_at at time zone 'America/Sao_Paulo')::date=j.brt_day order by publish_at desc,id desc limit 1;
  if v_content is null then update private.reminder_attempts set status='unavailable' where id=p_id;return null;end if;
  v_kind:=case when exists(select 1 from public.devotional_completions where user_id=j.user_id and completed_day=j.brt_day)
    then 'share' else 'reading' end;
  update private.reminder_attempts set status='dispatching',kind=v_kind,devotional_id=v_content,attempted_at=p_now where id=p_id;
  return jsonb_build_object('job',p_id,'mode',d.mode,'subscription',jsonb_build_object('endpoint',d.endpoint,'keys',
    jsonb_build_object('p256dh',d.p256dh,'auth',d.auth_key)),
    'payload',jsonb_build_object('v',1,'kind',v_kind,'binding',d.binding,'day',j.brt_day,'devotional',v_content));
end $$;
create function private.finish_reminder(p_id uuid,p_result text) returns void
language plpgsql set search_path='' as $$
begin
  if p_result not in ('simulated','accepted','failed','uncertain','expired') then raise exception 'Invalid outcome';end if;
  update private.reminder_attempts set status=p_result where id=p_id and status='dispatching';
  if found and p_result='expired' then
    update private.push_devices set state='expired',endpoint=null,p256dh=null,auth_key=null,updated_at=clock_timestamp()
      where device_id=(select device_id from private.reminder_attempts where id=p_id);
  end if;
end $$;
create function private.claim_push_proofs(p_now timestamptz default clock_timestamp()) returns setof jsonb
language plpgsql set search_path='' as $$
declare d private.push_devices%rowtype;
begin
  for d in select * from private.push_devices where state='pending' and mode='webpush' and permission='granted'
    and expires_at>p_now and proof_attempted_at is null
    and exists(select 1 from public.reminder_preferences p where p.user_id=push_devices.user_id and p.enabled)
    and exists(select 1 from auth.sessions s where s.id=push_devices.session_id and s.user_id=push_devices.user_id and (s.not_after is null or s.not_after>p_now))
    order by updated_at limit 100 for update skip locked
  loop
    update private.push_devices set proof_attempted_at=p_now where device_id=d.device_id;
    return next jsonb_build_object('mode','webpush','subscription',jsonb_build_object('endpoint',d.endpoint,'keys',
      jsonb_build_object('p256dh',d.p256dh,'auth',d.auth_key)),
      'payload',jsonb_build_object('v',1,'kind','verify','binding',d.binding,'proof',d.proof));
  end loop;
end $$;
create function private.cleanup_reminders(p_now timestamptz default clock_timestamp()) returns void
language plpgsql set search_path='' as $$
begin
  delete from private.reminder_attempts where reserved_at<p_now-interval '31 days';
  update private.push_devices set state='expired',endpoint=null,p256dh=null,auth_key=null,proof=null,updated_at=p_now
    where (state in ('active','pending') and expires_at<=p_now)
      or (state='pending' and proof_attempted_at<p_now-interval '10 minutes');
  delete from private.push_devices where state in ('revoked','expired','inactive') and updated_at<p_now-interval '30 days';
end $$;

-- No blanket schema ACL changes: preserve every earlier OWNER/reading grant.
do $$ declare r record;begin
  for r in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='private' and p.proname in ('reminder_due_at','reminder_next_due','claim_reminders','prepare_reminder','finish_reminder','claim_push_proofs','cleanup_reminders'))
       or (n.nspname='public' and p.proname in ('get_my_reminders','save_my_reminders','revoke_my_push_device','confirm_my_push_device'))
  loop
    execute format('alter function %s owner to postgres',r.signature);
    execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
    if r.nspname='public' then execute format('grant execute on function %s to authenticated',r.signature);end if;
  end loop;
end $$;
commit;
