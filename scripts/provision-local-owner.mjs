import { openOwnerEnvironment, parseOwnerArguments, runOwnerOperation } from './local-owner-tools.mjs'
// Trusted OS/database operator only. Human identity confirmation is external;
// neither email confirmation nor repeating a UUID establishes ownership.
try {
  const local=openOwnerEnvironment()
  const request=parseOwnerArguments(process.argv.slice(2))
  if(request.action==='check')console.log('Local OWNER preflight passed. No account inspected or permission changed.')
  else if(request.action==='inspect')console.log('Exact target local checks: '+JSON.stringify(runOwnerOperation(local,request)))
  else {
    runOwnerOperation(local,request)
    console.log('Local OWNER '+request.action+' committed with private audit. Editorial memberships unchanged. No identifiers or credentials printed.')
  }
} catch {
  console.error('OWNER operation refused or unavailable. Verify local environment, exact confirmed UUID, current owner state, eligibility and unique audit reference. No identifiers, SQL or credentials printed.')
  process.exitCode=1
}
