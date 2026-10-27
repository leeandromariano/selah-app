import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { openOwnerEnvironment } from './local-owner-tools.mjs'
try {
  const local=openOwnerEnvironment()
  if(process.argv.slice(2).join()==='--check-local')console.log('Local community read-only audit preflight passed. No changes.')
  else {
    if(process.argv.length!==2)throw Error('Unexpected arguments')
    const sql=readFileSync('scripts/audit-local-community.sql','utf8')
    const output=local.psql(sql)
    const rows=output.split(/\r?\n/).map(s=>s.trim()).filter(s=>s.startsWith('{')).map(s=>JSON.parse(s))
    if(rows.length!==3||!output.includes('ROLLBACK'))throw Error('Incomplete audit')
    const candidate=readFileSync('supabase/migrations/20261028000400_owner_community.sql','utf8').replaceAll('\r\n','\n').match(/as \$\$([\s\S]*?)\$\$;/)?.[1]
    if(!candidate)throw Error('Missing candidate function')
    for(const row of rows) {
      if(row.kind==='authorization') {
        row.rpc_matches_candidate=row.rpc_source_md5===createHash('md5').update(candidate).digest('hex')
        delete row.rpc_source_md5
      }
      // Static SQL only emits named aggregates/booleans. Refuse any unexpected
      // value shape rather than risk printing identity or credential material.
      for(const [key,value] of Object.entries(row))if(key==='kind'? !['metrics','authorization','owner_probe'].includes(value):
        key==='server_today'?!/^\d{4}-\d{2}-\d{2}$/.test(value):typeof value!=='boolean'&&!(Number.isSafeInteger(value)&&value>=0))throw Error('Unsafe diagnostic shape')
    }
    for(const row of rows)console.log(JSON.stringify(row))
    console.log('Read-only local audit complete; transaction rolled back. No records changed or identifiers printed.')
  }
} catch {console.error('Local community read-only audit refused or failed. No SQL, identifiers or credentials printed.');process.exitCode=1}
