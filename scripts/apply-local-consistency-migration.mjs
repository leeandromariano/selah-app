import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { prepareLocalScript } from './local-environment.mjs'
const local=prepareLocalScript()
const previous='20261023000100,20261026000100,20261026000200,20261026000300,20261026000400,20261026000500,20261027000100,20261028000100,20261028000200'
const version='20261028000300',file=version+'_reader_consistency.sql'
const rows=local.psql('begin read only; select version from supabase_migrations.schema_migrations order by version; rollback;')
const versions=Array.from(rows.matchAll(/^\s*(\d{14})\s*$/gm),row=>row[1]).join(',')
const pending=readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')&&name>'20261028000200_\uffff')
if([previous+','+version,previous+','+version+',20261028000400',previous+','+version+',20261028000400,20261028000500'].includes(versions))console.log('Local consistency migration already applied. No changes executed.')
else if(versions!==previous||pending.join(',')!==file) {
  console.error('Unexpected local migration history or pending files. Nothing applied; operator review required.')
  process.exitCode=1
} else {
  const result=spawnSync(process.execPath,['node_modules/supabase/dist/supabase.js','migration','up','--local'],{env:local.docker.env,encoding:'utf8'})
  if(result.status!==0) {
    console.error('Local incremental consistency migration failed. No reset or remote operation attempted.')
    const code=((result.stderr||'')+(result.stdout||'')).match(/SQLSTATE ([A-Z0-9]{5})/)
    if(code)console.error('SQLSTATE '+code[1])
    process.exitCode=1
  } else console.log('Local read-only consistency RPC and index applied. Existing records retained.')
}
