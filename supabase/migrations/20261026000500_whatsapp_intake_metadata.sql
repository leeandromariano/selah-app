begin;
-- Intake fields must not become durable Auth metadata or confirmation JWT claims.
create function private.strip_whatsapp_intake() returns trigger
language plpgsql set search_path='' as $$
begin
  new.raw_user_meta_data := new.raw_user_meta_data - 'whatsapp' - 'feedback_contact_allowed';
  return new;
end;
$$;
revoke all on function private.strip_whatsapp_intake() from public,anon,authenticated;
create trigger strip_whatsapp_intake before update of raw_user_meta_data on auth.users
for each row execute function private.strip_whatsapp_intake();

create or replace function private.signup_whatsapp_profile() returns trigger
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
  update auth.users set raw_user_meta_data=raw_user_meta_data-'whatsapp'-'feedback_contact_allowed' where id=new.id;
  return new;
end;
$$;
alter function private.signup_whatsapp_profile() owner to postgres;
revoke all on function private.signup_whatsapp_profile() from public,anon,authenticated;
commit;
