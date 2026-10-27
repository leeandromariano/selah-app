import { readFileSync } from 'node:fs'
import { openOwnerEnvironment } from './local-owner-tools.mjs'
try {
  const local=openOwnerEnvironment()
  if(process.argv.slice(2).join() === '--check-local')console.log('Local OWNER audit preflight passed. No changes.')
  else {
    if(process.argv.length!==2)throw Error('Unexpected arguments')
    const previous=['20261023000100','20261026000100','20261026000200','20261026000300','20261026000400','20261026000500','20261027000100','20261028000100','20261028000200','20261028000300','20261028000400']
    const version='20261028000500'
    const rows=local.psql('begin read only; select version from supabase_migrations.schema_migrations order by version; rollback;')
    const versions=Array.from(rows.matchAll(/^\s*(\d{14})\s*$/gm),r=>r[1])
    if(versions.join()===[...previous,version].join())console.log('Local OWNER audit migration already applied. No changes.')
    else if(versions.join()!==previous.join())throw Error('Unexpected migration history')
    else {
      const source=readFileSync('supabase/migrations/'+version+'_owner_provision_audit.sql','utf8')
      if(!source.startsWith('begin;')||!source.endsWith('commit;\n'))throw Error('Expected transaction')
      local.psql(source.replace(/commit;\s*$/,`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','owner_provision_audit',array[]::text[]); commit;`))
      console.log('Local private OWNER audit journal created. No account promoted or editorial membership changed.')
    }
  }
} catch { console.error('Local OWNER audit migration refused or unavailable. No identifiers or credentials printed.');process.exitCode=1 }
