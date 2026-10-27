-- Server-only, local username/password gateway. No username -> email API/RPC.
begin;
create table private.password_login_limits (
  bucket text primary key,
  started_at timestamptz not null,
  attempts integer not null check (attempts > 0)
);
alter table private.password_login_limits enable row level security;
revoke all on private.password_login_limits from public, anon, authenticated, service_role;

-- A single row lock serializes budgets across workers and concurrent requests.
-- Only the trusted server connection (postgres) may consume these budgets.
create function private.consume_password_login_attempt(p_bucket text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  instant timestamptz := clock_timestamp();
  global_budget private.password_login_limits;
  identifier_budget private.password_login_limits;
begin
  if p_bucket is null or p_bucket !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid login budget' using errcode = '22023';
  end if;
  insert into private.password_login_limits values ('global', instant, 1)
  on conflict (bucket) do update set
    started_at = case when password_login_limits.started_at <= instant - interval '1 minute' then instant else password_login_limits.started_at end,
    attempts = case when password_login_limits.started_at <= instant - interval '1 minute' then 1 else least(password_login_limits.attempts + 1, 61) end
  returning * into global_budget;
  if global_budget.attempts > 60 then return false; end if;

  insert into private.password_login_limits values (p_bucket, instant, 1)
  on conflict (bucket) do update set
    started_at = case when password_login_limits.started_at <= instant - interval '10 minutes' then instant else password_login_limits.started_at end,
    attempts = case when password_login_limits.started_at <= instant - interval '10 minutes' then 1 else least(password_login_limits.attempts + 1, 11) end
  returning * into identifier_budget;
  return identifier_budget.attempts <= 10;
end $$;
alter function private.consume_password_login_attempt(text) owner to postgres;
revoke all on function private.consume_password_login_attempt(text) from public, anon, authenticated, service_role;
commit;
