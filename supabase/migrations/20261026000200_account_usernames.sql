begin;
-- Existing Auth accounts are deliberately not backfilled or modified.
create table public.account_usernames (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  username text not null unique,
  constraint account_username_format check (
    username = lower(btrim(username)) and username ~ '^[a-z][a-z0-9_]{2,23}$'
    and username not in ('admin','administrador','administrator','root','support','suporte','selah','system','sistema','auth','api','www','anonymous','account','perfil','login','cadastro','privacidade','null','true','false')
  )
);
alter table public.account_usernames enable row level security;
revoke all on public.account_usernames from public, anon, authenticated;
grant select on public.account_usernames to authenticated;
grant insert (username) on public.account_usernames to authenticated;
create policy usernames_read_own on public.account_usernames for select to authenticated
using (user_id = (select auth.uid()));
create policy usernames_claim_own on public.account_usernames for insert to authenticated
with check (user_id = (select auth.uid()));

create function private.normalize_account_username() returns trigger
language plpgsql set search_path = '' as $$
begin new.username := lower(btrim(new.username)); return new; end;
$$;
revoke all on function private.normalize_account_username() from public, anon, authenticated;
create trigger normalize_account_username before insert on public.account_usernames
for each row execute function private.normalize_account_username();

-- AFTER INSERT runs inside the same Auth transaction. Failure rolls back the user.
-- No client-callable RPC, email lookup, public directory or metadata-based privilege.
create function private.reserve_signup_username() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(new.raw_user_meta_data -> 'username') is distinct from 'string' then
    raise exception 'A valid username is required' using errcode = '23514';
  end if;
  insert into public.account_usernames(user_id,username)
    values (new.id,new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;
alter function private.reserve_signup_username() owner to postgres;
revoke all on function private.reserve_signup_username() from public, anon, authenticated;
create trigger reserve_signup_username after insert on auth.users
for each row execute function private.reserve_signup_username();
commit;
