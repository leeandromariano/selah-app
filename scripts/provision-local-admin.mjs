import { setLocalAdmin } from './local-admin-tools.mjs'
import { prepareLocalScript } from './local-environment.mjs'
if (process.argv[2] === '--check-local') prepareLocalScript()
const [action, userId, ...extra] = process.argv.slice(2)
if (!['grant', 'revoke'].includes(action) || !userId || extra.length) {
  console.error('Usage: node scripts/provision-local-admin.mjs grant|revoke AUTH_UUID')
  process.exit(1)
}
try {
  setLocalAdmin(userId, action === 'grant')
  console.log(action === 'grant' ? 'Local administration granted to the confirmed Auth UUID. Sign in again to refresh the interface.' : 'Local administration revoked. Server authorization checks use current membership.')
} catch {
  console.error('Operation refused or unavailable. Check local Docker/Supabase and the confirmed fictitious Auth UUID. No credentials printed.')
  process.exitCode = 1
}
