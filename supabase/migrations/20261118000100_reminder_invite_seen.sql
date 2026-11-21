begin;

-- O convite para ativar as notificações aparece UMA vez por pessoa (conta), em qualquer navegador ou aparelho.
-- A marca fica na linha de preferências de lembretes. Gravar a marca não liga lembretes: enabled continua falso.
alter table public.reminder_preferences add column invite_seen_at timestamptz;

create or replace function public.get_my_reminders(p_device uuid default null,p_secret text default null) returns jsonb
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
    'invite_seen',coalesce((select invite_seen_at is not null from public.reminder_preferences where user_id=v_user),false),
    'mode',(select mode from private.push_configuration),'vapid_public_key',(select vapid_public_key from private.push_configuration),
    'device',case when v_device.device_id is null then null else jsonb_build_object('id',v_device.device_id,'binding',v_device.binding,
      'mode',v_device.mode,'state',v_device.state,'permission',v_device.permission,'time',to_char(v_device.local_time,'HH24:MI'),
      'timezone',v_device.timezone,'expires_at',v_device.expires_at) end,'last',v_last);
end $$;

create function public.mark_reminder_invite_seen() returns void
language plpgsql volatile security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501';end if;
  insert into public.reminder_preferences(user_id,enabled,invite_seen_at) values(v_user,false,clock_timestamp())
    on conflict(user_id) do update set invite_seen_at=coalesce(public.reminder_preferences.invite_seen_at,clock_timestamp());
end $$;

alter function public.get_my_reminders(uuid,text) owner to postgres;
alter function public.mark_reminder_invite_seen() owner to postgres;
revoke all on function public.get_my_reminders(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.mark_reminder_invite_seen() from public,anon,authenticated,service_role;
grant execute on function public.get_my_reminders(uuid,text) to authenticated;
grant execute on function public.mark_reminder_invite_seen() to authenticated;

commit;
