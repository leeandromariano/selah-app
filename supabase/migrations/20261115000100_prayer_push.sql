begin;

-- Lembrete por push da Cápsula de Oração, sobre o sistema de lembretes que já existe (opt-in por conta e por dispositivo,
-- no máximo uma mensagem por dispositivo por dia). Quando um pedido chega na data de revisão, o próximo lembrete
-- do dispositivo diz apenas que há pedido para rever. NUNCA vai texto do pedido na notificação, nem nada além do tipo e do dia.
-- Cada pedido gera no máximo um aviso por data de revisão (notified_on); depois disso só o card da Home continua lembrando.
alter table public.prayer_capsules add column notified_on date;

do $$
declare c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'private.reminder_attempts'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%kind%';
  if c is not null then execute format('alter table private.reminder_attempts drop constraint %I', c); end if;
end $$;
alter table private.reminder_attempts add constraint reminder_attempts_kind_check check (kind in ('reading', 'share', 'prayer'));

create or replace function private.prepare_reminder(p_id uuid,p_now timestamptz default clock_timestamp()) returns jsonb
language plpgsql set search_path='' as $$
declare j private.reminder_attempts%rowtype;d private.push_devices%rowtype;v_content uuid;v_kind text;v_prayers integer;
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
  -- Pedidos de oração cuja data de revisão chegou e que ainda não geraram aviso: o lembrete do dia passa a ser o de oração.
  update public.prayer_capsules set notified_on=j.brt_day
    where user_id=j.user_id and status='open' and review_on<=j.brt_day and notified_on is null;
  get diagnostics v_prayers=row_count;
  if v_prayers>0 then
    update private.reminder_attempts set status='dispatching',kind='prayer',devotional_id=null,attempted_at=p_now where id=p_id;
    return jsonb_build_object('job',p_id,'mode',d.mode,'subscription',jsonb_build_object('endpoint',d.endpoint,'keys',
      jsonb_build_object('p256dh',d.p256dh,'auth',d.auth_key)),
      'payload',jsonb_build_object('v',1,'kind','prayer','binding',d.binding,'day',j.brt_day));
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

-- "Ainda aguardando" adia a revisão: o novo prazo volta a poder gerar um aviso.
create or replace function public.prayer_snooze(p_id uuid, p_days integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_row public.prayer_capsules;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_days is null or p_days not in (7, 14, 30, 60, 90, 180) then raise exception 'Escolha quando rever o pedido.' using errcode = '22023'; end if;
  update public.prayer_capsules set review_on = private.prayer_today() + p_days, notified_on = null
    where id = p_id and user_id = v_user and status = 'open' returning * into v_row;
  if not found then raise exception 'Pedido não encontrado.' using errcode = 'P0002'; end if;
  return private.prayer_item(v_row);
end $$;

commit;
