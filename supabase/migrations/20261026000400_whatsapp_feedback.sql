begin;
alter table public.profiles add column whatsapp_required boolean not null default false;
alter table public.profiles add constraint profiles_required_whatsapp
  check (not whatsapp_required or phone is not null);

create function private.normalize_profile_whatsapp() returns trigger
language plpgsql set search_path='' as $$
begin
  new.phone := nullif(regexp_replace(btrim(new.phone),'[ ().-]','','g'),'');
  if new.whatsapp_required and (new.phone is null or new.phone !~ '^\+[1-9][0-9]{7,14}$'
    or (new.phone like '+55%' and new.phone !~ '^\+55[1-9]{2}9[0-9]{8}$')) then
    raise exception 'Valid WhatsApp required' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function private.normalize_profile_whatsapp() from public,anon,authenticated;
create trigger normalize_profile_whatsapp before insert or update of phone on public.profiles
for each row execute function private.normalize_profile_whatsapp();

create table public.feedback_contact_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  allowed boolean not null default false,
  decided_at timestamptz not null default now(),
  purpose_version text not null default 'feedback-v1' check(purpose_version='feedback-v1')
);
alter table public.feedback_contact_preferences enable row level security;
revoke all on public.feedback_contact_preferences from public,anon,authenticated;
grant select on public.feedback_contact_preferences to authenticated;
create policy feedback_read_own on public.feedback_contact_preferences for select to authenticated
using(user_id=(select auth.uid()));

create function private.signup_whatsapp_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare number text; choice boolean := false;
begin
  if jsonb_typeof(new.raw_user_meta_data->'whatsapp') is distinct from 'string' then
    raise exception 'WhatsApp required' using errcode='23514';
  end if;
  number := regexp_replace(btrim(new.raw_user_meta_data->>'whatsapp'),'[ ().-]','','g');
  if number !~ '^\+[1-9][0-9]{7,14}$' or
     (number like '+55%' and number !~ '^\+55[1-9]{2}9[0-9]{8}$') then
    raise exception 'Invalid WhatsApp format' using errcode='23514';
  end if;
  if new.raw_user_meta_data ? 'feedback_contact_allowed' then
    if jsonb_typeof(new.raw_user_meta_data->'feedback_contact_allowed') is distinct from 'boolean' then
      raise exception 'Invalid feedback choice' using errcode='23514';
    end if;
    choice := (new.raw_user_meta_data->>'feedback_contact_allowed')::boolean;
  end if;
  insert into public.profiles(id,phone,whatsapp_required) values(new.id,number,true);
  insert into public.feedback_contact_preferences(user_id,allowed) values(new.id,choice);
  return new;
end;
$$;
alter function private.signup_whatsapp_profile() owner to postgres;
revoke all on function private.signup_whatsapp_profile() from public,anon,authenticated;
create trigger signup_whatsapp_profile after insert on auth.users
for each row execute function private.signup_whatsapp_profile();

-- Locks always follow profile -> preference order; caller cannot choose a user ID.
create function public.set_feedback_contact(p_user_id uuid,p_expected_phone text,p_allowed boolean)
returns public.feedback_contact_preferences
language plpgsql security definer set search_path='' as $$
declare own_id uuid := auth.uid(); current_phone text; result public.feedback_contact_preferences;
begin
  if own_id is null or own_id is distinct from p_user_id then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_allowed is null then raise exception 'Explicit choice required' using errcode='23514'; end if;
  select phone into current_phone from public.profiles where id=own_id for update;
  if p_allowed and (current_phone is null or current_phone is distinct from p_expected_phone) then
    raise exception 'Reload and confirm current WhatsApp' using errcode='23514';
  end if;
  insert into public.feedback_contact_preferences(user_id,allowed,decided_at)
  values(own_id,p_allowed,clock_timestamp())
  on conflict(user_id) do update set allowed=excluded.allowed,decided_at=excluded.decided_at
  returning * into result;
  return result;
end;
$$;
alter function public.set_feedback_contact(uuid,text,boolean) owner to postgres;
revoke all on function public.set_feedback_contact(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.set_feedback_contact(uuid,text,boolean) to authenticated;

create function private.revoke_feedback_on_phone_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.phone is distinct from new.phone then
    update public.feedback_contact_preferences set allowed=false,decided_at=clock_timestamp()
    where user_id=new.id and allowed;
  end if;
  return new;
end;
$$;
alter function private.revoke_feedback_on_phone_change() owner to postgres;
revoke all on function private.revoke_feedback_on_phone_change() from public,anon,authenticated;
create trigger revoke_feedback_on_phone_change after update of phone on public.profiles
for each row execute function private.revoke_feedback_on_phone_change();
commit;
