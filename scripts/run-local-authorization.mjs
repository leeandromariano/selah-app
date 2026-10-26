// Opt-in only: the SQL suite owns BEGIN/ROLLBACK; no schema or persistent fixtures.
import { readFileSync } from 'node:fs'
import { prepareLocalScript } from './local-environment.mjs'
const local = prepareLocalScript()
try {
  process.stdout.write(local.psql(readFileSync('supabase/tests/authorization.sql', 'utf8')))
} catch {
  console.error('Local authorization suite failed; validation is incomplete. No credentials printed.')
  process.exitCode = 1
}
