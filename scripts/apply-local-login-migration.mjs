import { spawnSync } from 'node:child_process'
import { prepareLocalScript } from './local-environment.mjs'
const local = prepareLocalScript()
// This operator command is deliberately limited to the reviewed login change.
// It never resets a database or accepts arbitrary CLI options/destinations.
const rows = local.psql('begin read only; select version from supabase_migrations.schema_migrations order by version; rollback;')
const versions = Array.from(rows.matchAll(/^\s*(\d{14})\s*$/gm), item => item[1])
if (versions.at(-1) === '20261027000100') {
  console.log('Local login migration already applied. No changes executed.')
} else if (versions.join(',') !== '20261023000100,20261026000100,20261026000200,20261026000300,20261026000400,20261026000500') {
  console.error('Unexpected local migration history; operator review required. No changes executed.')
  process.exitCode = 1
} else {
  // Ensure CLI cannot accidentally apply another future, unreviewed migration.
  const { readdirSync } = await import('node:fs')
  const pending = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql') && name > '20261026000500_\uffff')
  if (pending.join(',') !== '20261027000100_password_login_limits.sql') {
    console.error('Unexpected pending migration; operator review required. No changes executed.')
    process.exitCode = 1
  } else {
    const result = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'migration', 'up', '--local'], { env: local.docker.env, encoding: 'utf8' })
    if (result.status !== 0) {
      console.error('Local incremental migration failed. No remote operation attempted; no diagnostics or credentials printed.')
      process.exitCode = 1
    } else console.log('Local login migration applied. No reset or existing account changes.')
  }
}
