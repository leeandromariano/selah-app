import { readFileSync } from 'node:fs'
import { prepareLocalScript } from './local-environment.mjs'
const local=prepareLocalScript()
const result=local.docker.run(['exec','-i','supabase_db_devocionais-app','psql','-X','-h','/var/run/postgresql','-p','5432','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:readFileSync('supabase/tests/owner-community.sql','utf8'),encoding:'utf8'})
if(result.status!==0 || !result.stdout.includes('ROLLBACK')) {
  console.error((result.stderr||'').match(/ERROR:[^\r\n]*/)?.[0] || 'Owner SQL failed; transaction rolled back.')
  process.exitCode=1
} else console.log(result.stdout.match(/\d+ owner SQL checks passed; ROLLBACK complete\./)?.[0])
