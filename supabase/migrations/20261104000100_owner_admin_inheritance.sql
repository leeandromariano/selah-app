begin;

-- OWNER inherits every existing ADMIN editorial capability without acquiring
-- membership in private.admin_users. A legacy ADMIN never becomes OWNER.
-- The OWNER path uses the exact active-account eligibility rules enforced by
-- private.owner_identity(): confirmed, not deleted/anonymous/suspended and
-- without a pending account-deletion request.
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.admin_users a
    where a.user_id = (select auth.uid())
  ) or exists (
    select 1
    from private.app_owner o
    join auth.users u on u.id = o.user_id
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
      and u.deleted_at is null
      and not coalesce(u.is_anonymous, false)
      and (u.banned_until is null or u.banned_until <= clock_timestamp())
      and not exists (
        select 1 from public.account_deletion_requests d
        where d.user_id = u.id
      )
  );
$$;

alter function private.is_admin() owner to postgres;
revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

-- Existing RLS policies and public.devotional_open_counts() already call
-- private.is_admin(). No role-table changes, grants on private tables,
-- extra API endpoints, migrations from the editorial release or owner grants.
commit;
