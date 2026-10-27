import { readFileSync } from 'node:fs'
import { openOwnerEnvironment } from './local-owner-tools.mjs'
try {
  const local=openOwnerEnvironment()
  if(process.argv[2]==='--check-local')console.log('Local OWNER audit SQL preflight passed. No changes.')
  else {
    if(process.argv.length!==2)throw Error('Unexpected argument')
    const output=local.psql(readFileSync('supabase/tests/owner-provision-audit.sql','utf8'))
    const summary=output.match(/\d+ owner audit SQL checks passed; ROLLBACK complete\./)?.[0]
    if(!summary||!output.includes('ROLLBACK'))throw Error('No completed rollback suite')
    console.log(summary)
  }
}catch {console.error('Local OWNER audit SQL refused or failed; no diagnostics or identifiers printed.');process.exitCode=1}
