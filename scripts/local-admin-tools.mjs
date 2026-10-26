import { spawnSync } from 'node:child_process'
import { localDocker } from './local-docker.mjs'

export function localAdminConfig() {
  const docker = localDocker()
  const status = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8', env: docker.env })
  if (status.status !== 0) throw new Error('Local Supabase status unavailable')
  const config = JSON.parse(status.stdout)
  const database = new URL(config.DB_URL)
  if (config.API_URL !== 'http://127.0.0.1:54321' || database.hostname !== '127.0.0.1' || database.port !== '54322') throw new Error('Non-local target rejected')
  const ports = docker.run(['port', 'supabase_db_devocionais-app', '5432/tcp'], { encoding: 'utf8' })
  if (ports.status !== 0 || !ports.stdout.split(/\r?\n/).some(line => /:54322$/.test(line))) throw new Error('Local PostgreSQL mapping not verified')
  return { ...config, docker }
}

// Trusted operator only. No email matching, passwords, Auth admin API, or service_role.
// Does not create users; caller must provide an existing confirmed local Auth UUID.
export function setLocalAdmin(userId, enabled) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw new Error('Provide a valid Auth UUID')
  if (typeof enabled !== 'boolean') throw new Error('Explicit membership action required')
  const { docker } = localAdminConfig()
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
  const result = docker.run(['exec', '-i', 'supabase_db_devocionais-app', 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' })
  if (result.status !== 0) throw new Error('Local membership operation failed; no secrets printed')
}
