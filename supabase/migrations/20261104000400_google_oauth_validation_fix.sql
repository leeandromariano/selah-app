begin;

-- Follow-up to the already-applied local onboarding migration.
-- PostgreSQL regex strings need a single backslash to match literal '+'.
create or replace function private.signup_whatsapp_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare number text; choice boolean := false;
begin
  if new.raw_app_meta_data ->> 'provider' = 'google' then
    update auth.users
      set raw_user_meta_data = raw_user_meta_data - 'whatsapp' - 'feedback_contact_allowed'
      where id = new.id and (raw_user_meta_data ?| array['whatsapp','feedback_contact_allowed']);
    return new;
  end if;
  if jsonb_typeof(new.raw_user_meta_data -> 'whatsapp') is distinct from 'string' then
    raise exception 'WhatsApp required' using errcode = '23514';
  end if;
  number := regexp_replace(btrim(new.raw_user_meta_data ->> 'whatsapp'),'[ ().-]','','g');
  if number !~ '^\+[1-9][0-9]{7,14}$' or
     (number like '+55%' and number !~ '^\+55[1-9]{2}9[0-9]{8}$') then
    raise exception 'Invalid WhatsApp format' using errcode = '23514';
  end if;
  if new.raw_user_meta_data ? 'feedback_contact_allowed' then
    if jsonb_typeof(new.raw_user_meta_data -> 'feedback_contact_allowed') is distinct from 'boolean' then
      raise exception 'Invalid feedback choice' using errcode = '23514';
    end if;
    choice := (new.raw_user_meta_data ->> 'feedback_contact_allowed')::boolean;
  end if;
  insert into public.profiles(id,phone,whatsapp_required) values(new.id,number,true);
  insert into public.feedback_contact_preferences(user_id,allowed) values(new.id,choice);
  update auth.users set raw_user_meta_data=raw_user_meta_data-'whatsapp'-'feedback_contact_allowed' where id=new.id;
  return new;
end;
$$;
alter function private.signup_whatsapp_profile() owner to postgres;
revoke all on function private.signup_whatsapp_profile() from public, anon, authenticated, service_role;

create or replace function public.complete_google_onboarding(
  p_username text, p_whatsapp text, p_name text, p_feedback_contact_allowed boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user auth.users%rowtype;
  v_username text := lower(btrim(p_username));
  v_phone text := regexp_replace(btrim(p_whatsapp),'[ ().-]','','g');
  v_name text := nullif(btrim(p_name),'');
begin
  select * into v_user from auth.users where id = (select auth.uid()) for update;
  if not found or v_user.raw_app_meta_data ->> 'provider' is distinct from 'google'
    or v_user.email_confirmed_at is null or v_user.deleted_at is not null
    or coalesce(v_user.is_anonymous,false)
    or (v_user.banned_until is not null and v_user.banned_until > clock_timestamp())
    or exists (select 1 from public.account_deletion_requests d where d.user_id=v_user.id)
    or not private.google_onboarding_pending() then
    raise exception 'Google onboarding unavailable' using errcode = '42501';
  end if;
  if v_username is null or p_whatsapp is null or p_feedback_contact_allowed is null
    or v_username !~ '^[a-z][a-z0-9_]{2,23}$'
    or (p_name is not null and char_length(v_name) > 150)
    or v_phone !~ '^\+[1-9][0-9]{7,14}$'
    or (v_phone like '+55%' and v_phone !~ '^\+55[1-9]{2}9[0-9]{8}$') then
    raise exception 'Invalid onboarding fields' using errcode = '23514';
  end if;
  if exists (select 1 from public.account_usernames n where n.user_id = v_user.id)
     or exists (select 1 from public.profiles p where p.id = v_user.id) then
    raise exception 'Onboarding account state unavailable' using errcode = '42501';
  end if;
  insert into public.account_usernames(user_id,username) values(v_user.id,v_username);
  -- Existing profiles.name is NOT NULL: user-entered name remains optional,
  -- using a bounded Google display name or a neutral value if omitted.
  insert into public.profiles(id,name,phone,whatsapp_required)
    values(
      v_user.id,
      coalesce(v_name, nullif(left(btrim(v_user.raw_user_meta_data ->> 'full_name'),150),''), 'Leitor Selah'),
      v_phone,true
    );
  insert into public.feedback_contact_preferences(user_id,allowed)
    values(v_user.id,p_feedback_contact_allowed);
end;
$$;
alter function public.complete_google_onboarding(text,text,text,boolean) owner to postgres;
revoke all on function public.complete_google_onboarding(text,text,text,boolean) from public, anon, authenticated, service_role;
grant execute on function public.complete_google_onboarding(text,text,text,boolean) to authenticated;

commit;
