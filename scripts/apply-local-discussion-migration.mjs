import { readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { prepareLocalScript } from './local-environment.mjs'
const local=prepareLocalScript()
if(process.argv.length!==2)throw Error('Unexpected arguments')
const file='20261028000700_discussion.sql'
const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()
if(files.at(-1)!==file)throw Error('Unexpected migration candidates')
const rows=local.psql('begin read only; select version from supabase_migrations.schema_migrations order by version; rollback;')
const installed=Array.from(rows.matchAll(/^\s*(\d{14})\s*$/gm),row=>row[1]).join(',')
if(installed===files.map(f=>f.slice(0,14)).join(','))console.log('Discussion migration already installed; no changes.')
else {
  if(installed!==files.slice(0,-1).map(f=>f.slice(0,14)).join(',') || !readFileSync('supabase/migrations/'+file,'utf8').startsWith('begin;'))throw Error('Unexpected local history')
  const result=spawnSync(process.execPath,['node_modules/supabase/dist/supabase.js','migration','up','--local'],{env:local.docker.env,encoding:'utf8'})
  if(result.status!==0){console.error('Local discussion migration failed; no reset or remote operation.');process.exitCode=1}
  else console.log('Local discussion tables and RPCs installed. No existing users, readings or memberships changed.')
}
