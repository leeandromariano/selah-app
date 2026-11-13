begin;

-- Aviso por push quando uma devocional é publicada, na mesma opção de lembretes (opt-in por conta e por dispositivo).
-- É uma mensagem a mais além do lembrete diário, por isso tem tabela própria: não entra no limite de uma por dia.
-- Cada dispositivo recebe no máximo um aviso por devocional. O payload leva só o tipo, o dia e o id da devocional;
-- o texto da notificação é fixo no service worker.
create table private.publish_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references private.push_devices(device_id) on delete cascade,
  binding uuid not null,
  devotional_id uuid not null references public.devotionals(id) on delete cascade,
  status text not null check(status in ('reserved','dispatching','simulated','accepted','failed','uncertain','expired','cancelled')),
  reserved_at timestamptz not null,
  attempted_at timestamptz,
  unique(device_id, devotional_id)
);
alter table private.publish_notices enable row level security;
revoke all on private.publish_notices from public,anon,authenticated,service_role;

-- Reivindica avisos de devoções publicadas na última hora, para dispositivos ativos que já existiam antes da publicação.
create function private.claim_publish_notices(p_now timestamptz default clock_timestamp(),p_limit integer default 100,p_mode text default 'simulation') returns setof uuid
language plpgsql set search_path='' as $$
declare r record;v_id uuid;
begin
  if p_limit is null or p_limit<1 or p_limit>100 or p_mode is null or p_mode not in ('simulation','webpush') then raise exception 'Invalid batch';end if;
  update private.publish_notices set status='uncertain' where status in ('reserved','dispatching') and reserved_at<p_now-interval '2 minutes';
  for r in select x.device_id,x.user_id,x.binding,v.id devotional_id
    from private.push_devices x join public.reminder_preferences p using(user_id)
    join auth.users u on u.id=x.user_id
    cross join public.devotionals v
    where x.state='active' and x.mode=p_mode and x.permission='granted' and p.enabled and x.expires_at>p_now
      and v.status='published' and v.publish_at<=p_now and v.publish_at>p_now-interval '1 hour' and x.updated_at<=v.publish_at
      and u.deleted_at is null and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
      and (u.banned_until is null or u.banned_until<=p_now)
      and ((x.session_id is null and x.mode='simulation') or exists(select 1 from auth.sessions s where s.id=x.session_id and s.user_id=x.user_id and (s.not_after is null or s.not_after>p_now)))
      and not exists(select 1 from private.publish_notices n where n.device_id=x.device_id and n.devotional_id=v.id)
    order by v.publish_at,x.device_id limit p_limit
  loop
    v_id:=null;
    insert into private.publish_notices(user_id,device_id,binding,devotional_id,status,reserved_at)
      values(r.user_id,r.device_id,r.binding,r.devotional_id,'reserved',p_now)
      on conflict do nothing returning id into v_id;
    if v_id is not null then return next v_id;end if;
  end loop;
end $$;

-- Verificação final imediatamente antes de UMA tentativa de envio.
create function private.prepare_publish_notice(p_id uuid,p_now timestamptz default clock_timestamp()) returns jsonb
language plpgsql set search_path='' as $$
declare n private.publish_notices%rowtype;d private.push_devices%rowtype;
begin
  select * into n from private.publish_notices where id=p_id for update;
  if not found or n.status<>'reserved' then return null;end if;
  select * into d from private.push_devices where device_id=n.device_id for update;
  if n.reserved_at<p_now-interval '2 minutes'
    or d.state<>'active' or d.permission<>'granted' or d.binding<>n.binding or d.expires_at<=p_now
    or not ((d.session_id is null and d.mode='simulation') or exists(select 1 from auth.sessions s where s.id=d.session_id and s.user_id=d.user_id and (s.not_after is null or s.not_after>p_now)))
    or not coalesce((select enabled from public.reminder_preferences where user_id=n.user_id),false)
    or not exists(select 1 from auth.users where id=n.user_id and deleted_at is null and email_confirmed_at is not null
      and not coalesce(is_anonymous,false) and (banned_until is null or banned_until<=p_now))
    or not exists(select 1 from public.devotionals where id=n.devotional_id and status='published' and publish_at<=p_now) then
    update private.publish_notices set status='cancelled' where id=p_id;return null;
  end if;
  update private.publish_notices set status='dispatching',attempted_at=p_now where id=p_id;
  return jsonb_build_object('job',p_id,'mode',d.mode,'subscription',jsonb_build_object('endpoint',d.endpoint,'keys',
    jsonb_build_object('p256dh',d.p256dh,'auth',d.auth_key)),
    'payload',jsonb_build_object('v',1,'kind','new','binding',d.binding,
      'day',(p_now at time zone 'America/Sao_Paulo')::date,'devotional',n.devotional_id));
end $$;

create function private.finish_publish_notice(p_id uuid,p_result text) returns void
language plpgsql set search_path='' as $$
begin
  if p_result not in ('simulated','accepted','failed','uncertain','expired') then raise exception 'Invalid outcome';end if;
  update private.publish_notices set status=p_result where id=p_id and status='dispatching';
  if found and p_result='expired' then
    update private.push_devices set state='expired',endpoint=null,p256dh=null,auth_key=null,updated_at=clock_timestamp()
      where device_id=(select device_id from private.publish_notices where id=p_id);
  end if;
end $$;

-- Limpeza: mesma rotina de antes, mais os avisos antigos.
create or replace function private.cleanup_reminders(p_now timestamptz default clock_timestamp()) returns void
language plpgsql set search_path='' as $$
begin
  delete from private.reminder_attempts where reserved_at<p_now-interval '31 days';
  delete from private.publish_notices where reserved_at<p_now-interval '31 days';
  update private.push_devices set state='expired',endpoint=null,p256dh=null,auth_key=null,proof=null,updated_at=p_now
    where (state in ('active','pending') and expires_at<=p_now)
      or (state='pending' and proof_attempted_at<p_now-interval '10 minutes');
  delete from private.push_devices where state in ('revoked','expired','inactive') and updated_at<p_now-interval '30 days';
end $$;

do $$ declare r record;begin
  for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname in ('claim_publish_notices','prepare_publish_notice','finish_publish_notice','cleanup_reminders')
  loop
    execute format('alter function %s owner to postgres',r.signature);
    execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
  end loop;
end $$;

commit;
