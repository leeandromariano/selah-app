import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { prepareLocalScript } from './local-environment.mjs'
const local = prepareLocalScript()
const previous = '20261023000100,20261026000100,20261026000200,20261026000300,20261026000400,20261026000500,20261027000100'
const versionsToApply = ['20261028000100', '20261028000200']
const files = ['20261028000100_reading_completions.sql', '20261028000200_reading_claims_access.sql']
const rows = local.psql('begin read only; select version from supabase_migrations.schema_migrations order by version; rollback;')
const versions = Array.from(rows.matchAll(/^\s*(\d{14})\s*$/gm), row => row[1]).join(',')
const pending = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql') && name > '20261027000100_\uffff')
if (versions === previous + ',' + versionsToApply.join(',')) {
  console.log('Local reading migration already applied. No changes executed.')
} else if (![previous, previous + ',' + versionsToApply[0]].includes(versions) || pending.sort().join(',') !== files.join(',') || files.some(file => !readFileSync('supabase/migrations/' + file, 'utf8').startsWith('begin;'))) {
  console.error('Unexpected local migration history or pending files. Operator review required; nothing applied.')
  process.exitCode = 1
} else {
  const result = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'migration', 'up', '--local'], { env: local.docker.env, encoding: 'utf8' })
  if (result.status !== 0) {
    console.error('Local incremental reading migration failed. No reset or remote operation attempted.')
    const diagnostic = ((result.stderr || '') + (result.stdout || '')).replace(new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g'), '')
    const code = diagnostic.match(/SQLSTATE ([A-Z0-9]{5})/)
    const permission = /permission denied for schema (public|private|auth)/.exec(diagnostic)
    if (code) console.error('SQLSTATE ' + code[1])
    if (permission) console.error('Missing migration role permission for schema ' + permission[1])
    if (result.error) console.error('CLI execution error: ' + result.error.code)
    for (const line of diagnostic.split(/\r?\n/)) {
      const safe = line.match(/(?:ERROR:|Error:|failed |Cannot |invalid |must be ).*/i)?.[0]
      if (safe && !/https?:|postgres(?:ql)?:|password=|eyJ|sb_secret_/i.test(safe)) console.error(safe.slice(0, 240))
    }
    process.exitCode = 1
  } else console.log('Local incremental reading migration applied. Existing openings and accounts retained.')
}
