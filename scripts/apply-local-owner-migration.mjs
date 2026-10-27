import { readFileSync } from 'node:fs'
import { prepareLocalScript } from './local-environment.mjs'
const local = prepareLocalScript()
const rows = local.psql('begin read only; select version from supabase_migrations.schema_migrations order by version; rollback;')
const versions = Array.from(rows.matchAll(/^\s*(\d{14})\s*$/gm), r => r[1])
const previous = ['20261023000100','20261026000100','20261026000200','20261026000300','20261026000400','20261026000500','20261027000100','20261028000100','20261028000200','20261028000300']
const version = '20261028000400'
if ([[...previous,version],[...previous,version,'20261028000500']].some(known=>versions.join()===known.join())) console.log('Owner migration already applied locally; no changes.')
else if (versions.join() !== previous.join()) throw Error('Unexpected local history; nothing applied')
else {
  const sql = readFileSync('supabase/migrations/'+version+'_owner_community.sql','utf8')
  if (!sql.startsWith('begin;') || !sql.endsWith('commit;\n')) throw Error('Expected transactional migration')
  local.psql(sql.replace(/commit;\s*$/, `insert into supabase_migrations.schema_migrations(version,name,statements) values ('${version}','owner_community',array[]::text[]); commit;`))
  console.log('Incremental OWNER migration applied locally; no membership granted or existing data changed.')
}
