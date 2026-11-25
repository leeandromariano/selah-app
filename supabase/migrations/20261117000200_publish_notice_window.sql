begin;

-- Corrige claim_publish_notices: a regra "aparelho mais antigo que a publicação" (x.updated_at <= v.publish_at) usava a data da
-- última atualização do aparelho, que muda quando ele é confirmado. Um aparelho registrado ANTES da publicação, mas confirmado
-- depois, nunca recebia o aviso. A janela de 1 hora após a publicação já impede avisos de devoções antigas.
create or replace function private.claim_publish_notices(p_now timestamptz default clock_timestamp(),p_limit integer default 100,p_mode text default 'simulation') returns setof uuid
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
      and v.status='published' and v.publish_at<=p_now and v.publish_at>p_now-interval '1 hour'
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

alter function private.claim_publish_notices(timestamptz,integer,text) owner to postgres;
revoke all on function private.claim_publish_notices(timestamptz,integer,text) from public, anon, authenticated, service_role;

commit;
