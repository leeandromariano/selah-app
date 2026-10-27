begin;

-- Existing populated profiles are preserved. A display name is no longer required.
alter table public.profiles alter column name drop not null;

-- A request is a record for trusted manual review, NEVER an account deletion.
create table public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant select on public.account_deletion_requests to authenticated;
grant insert (user_id) on public.account_deletion_requests to authenticated;
create policy deletion_requests_read_own on public.account_deletion_requests
for select to authenticated using (user_id = (select auth.uid()));
create policy deletion_requests_insert_own on public.account_deletion_requests
for insert to authenticated with check (user_id = (select auth.uid()));

commit;
