begin;

-- Existing password/email registrations keep their required username and
-- WhatsApp at auth.users INSERT. Only genuine Google OAuth accounts, identified
-- by Auth-controlled app_metadata (never user_metadata), enter pending onboarding.
create or replace function private.reserve_signup_username() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data ->> 'provider' = 'google' then
    return new;
  end if;
  if jsonb_typeof(new.raw_user_meta_data -> 'username') is distinct from 'string' then
    raise exception 'A valid username is required' using errcode = '23514';
  end if;
  insert into public.account_usernames(user_id,username)
    values (new.id,new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;
alter function private.reserve_signup_username() owner to postgres;
revoke all on function private.reserve_signup_username() from public, anon, authenticated, service_role;

create or replace function private.signup_whatsapp_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare number text; choice boolean := false;
begin
  if new.raw_app_meta_data ->> 'provider' = 'google' then
    return new;
  end if;
  if jsonb_typeof(new.raw_user_meta_data -> 'whatsapp') is distinct from 'string' then
    raise exception 'WhatsApp required' using errcode = '23514';
  end if;
  number := regexp_replace(btrim(new.raw_user_meta_data ->> 'whatsapp'),'[ ().-]','','g');
  if number !~ '^\\+[1-9][0-9]{7,14}$' or
     (number like '+55%' and number !~ '^\\+55[1-9]{2}9[0-9]{8}$') then
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

-- A Google user is pending until both required records have been created.
-- The helper is private and uses auth.uid() from a verified Supabase JWT.
create function private.google_onboarding_pending() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from auth.users u
    where u.id = (select auth.uid())
      and u.raw_app_meta_data ->> 'provider' = 'google'
      and (
        not exists (select 1 from public.account_usernames n where n.user_id = u.id)
        or not exists (
          select 1 from public.profiles p where p.id = u.id
            and p.whatsapp_required and p.phone is not null
        )
      )
  );
$$;
alter function private.google_onboarding_pending() owner to postgres;
revoke all on function private.google_onboarding_pending() from public, anon, authenticated, service_role;
grant execute on function private.google_onboarding_pending() to authenticated;

create function public.get_my_google_onboarding_status() returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if private.google_onboarding_pending() then return 'pending'; end if;
  return 'complete';
end;
$$;
alter function public.get_my_google_onboarding_status() owner to postgres;
revoke all on function public.get_my_google_onboarding_status() from public, anon, authenticated, service_role;
grant execute on function public.get_my_google_onboarding_status() to authenticated;

-- Complete username, phone and feedback preference in a single transaction.
-- No arbitrary user ID, privilege, or Google-supplied contact permission.
create function public.complete_google_onboarding(
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
    or v_phone !~ '^\\+[1-9][0-9]{7,14}$'
    or (v_phone like '+55%' and v_phone !~ '^\\+55[1-9]{2}9[0-9]{8}$') then
    raise exception 'Invalid onboarding fields' using errcode = '23514';
  end if;
  -- The username constraint rejects reserved words; uniqueness is atomic.
  -- Existing accounts with a partial intake must not overwrite data.
  if exists (select 1 from public.account_usernames n where n.user_id = v_user.id)
     or exists (select 1 from public.profiles p where p.id = v_user.id) then
    raise exception 'Onboarding account state unavailable' using errcode = '42501';
  end if;
  insert into public.account_usernames(user_id,username) values(v_user.id,v_username);
  insert into public.profiles(id,name,phone,whatsapp_required)
    values(v_user.id,v_name,v_phone,true);
  insert into public.feedback_contact_preferences(user_id,allowed)
    values(v_user.id,p_feedback_contact_allowed);
end;
$$;
alter function public.complete_google_onboarding(text,text,text,boolean) owner to postgres;
revoke all on function public.complete_google_onboarding(text,text,text,boolean) from public, anon, authenticated, service_role;
grant execute on function public.complete_google_onboarding(text,text,text,boolean) to authenticated;

-- Pending Google accounts may complete onboarding, but cannot bypass the app
-- gate using direct PostgREST requests to the reader tables.
create policy google_onboarding_guard_devotionals on public.devotionals
  as restrictive for all to authenticated
  using (not private.google_onboarding_pending())
  with check (not private.google_onboarding_pending());
create policy google_onboarding_guard_views on public.devotional_views
  as restrictive for all to authenticated
  using (not private.google_onboarding_pending())
  with check (not private.google_onboarding_pending());
create policy google_onboarding_guard_reading_progress on public.reading_progress
  as restrictive for all to authenticated
  using (not private.google_onboarding_pending())
  with check (not private.google_onboarding_pending());
create policy google_onboarding_guard_completions on public.devotional_completions
  as restrictive for all to authenticated
  using (not private.google_onboarding_pending())
  with check (not private.google_onboarding_pending());
create policy google_onboarding_guard_profiles on public.profiles
  as restrictive for all to authenticated
  using (not private.google_onboarding_pending())
  with check (not private.google_onboarding_pending());
create policy google_onboarding_guard_usernames on public.account_usernames
  as restrictive for all to authenticated
  using (not private.google_onboarding_pending())
  with check (not private.google_onboarding_pending());
create policy google_onboarding_guard_reminders on public.reminder_preferences
  as restrictive for all to authenticated
  using (not private.google_onboarding_pending())
  with check (not private.google_onboarding_pending());

commit;
