import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { prepareLocalScript } from './local-environment.mjs'
const local = prepareLocalScript()
const file = '20261028000600_smart_reminders.sql'
const versions = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()
if (versions.at(-1) !== file) throw Error('Unexpected pending migrations')
const rows = local.psql('begin read only; select version from supabase_migrations.schema_migrations order by version; rollback;')
const installed = Array.from(rows.matchAll(/^\s*(\d{14})\s*$/gm), row => row[1]).join(',')
if (installed === versions.map(f => f.slice(0, 14)).join(',')) console.log('Reminder migration already installed; nothing applied.')
else {
  if (installed !== versions.slice(0, -1).map(f => f.slice(0, 14)).join(',')) throw Error('Unexpected local migration history')
  const result = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'migration', 'up', '--local'], { env: local.docker.env, encoding: 'utf8' })
  if (result.status !== 0) { console.error('Local incremental reminder migration failed; no reset or remote operation attempted.'); process.exitCode = 1 }
  else console.log('Local reminder tables/RPCs installed. No existing users or reading records changed.')
}
