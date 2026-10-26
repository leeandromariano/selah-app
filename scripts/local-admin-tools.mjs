import { openLocalEnvironment } from './local-environment.mjs'

export const localAdminConfig = openLocalEnvironment

// Trusted operator only. No email matching, passwords, Auth admin API, or service_role.
// Does not create users; caller must provide an existing confirmed local Auth UUID.
export function setLocalAdmin(userId, enabled) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw new Error('Provide a valid Auth UUID')
  if (typeof enabled !== 'boolean') throw new Error('Explicit membership action required')
  const local = openLocalEnvironment()
  const mutation = enabled
    ? `insert into private.admin_users (user_id) values ('${userId}') on conflict (user_id) do nothing;`
    : `delete from private.admin_users where user_id = '${userId}';`
  const sql = `begin;
    do $local_admin$ begin
      if not exists (select 1 from auth.users where id = '${userId}' and email_confirmed_at is not null) then
        raise exception 'Confirmed local Auth user required';
      end if;
      ${mutation}
    end $local_admin$;
    commit;`
  local.psql(sql)
}
