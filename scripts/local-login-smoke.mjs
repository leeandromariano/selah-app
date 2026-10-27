// Opt-in HTTP/SQL integration. Only synthetic local accounts; no deletions.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { prepareLocalScript, localUrl } from './local-environment.mjs'
import { setLocalAdmin } from './local-admin-tools.mjs'
import { passwordLogin } from '../src/auth/passwordLogin.ts'
const local = prepareLocalScript()
if (process.argv[2] === '--sql') {
  try { process.stdout.write(local.psql(readFileSync('supabase/tests/password-login.sql', 'utf8'))) }
  catch { console.error('Local login SQL failed; remaining checks NOT executed.'); process.exit(1) }
  process.exit(0)
}
let passed = 0, stage = 'setup', adminId
const password = `Fiction-${randomUUID()}!`
const username = () => 'u' + randomUUID().replaceAll('-', '').slice(0, 20)
const email = () => `selah-login-${randomUUID()}@example.invalid`
function check(ok, label) { stage = label; if (!ok) throw Error('Check failed'); passed++; console.log('PASS ' + label) }
async function call(identifier, secret = password, headers = {}) {
  const start = performance.now()
  const response = await local.fetch(`${local.api}/functions/v1/password-login`, { method: 'POST', headers: { apikey: local.publicKey, 'content-type': 'application/json', ...headers }, body: JSON.stringify({ identifier, password: secret }) })
  return { status: response.status, data: await response.json(), ms: Math.round(performance.now() - start), headers: response.headers }
}
async function signup() {
  const account = { email: email(), username: username(), client: local.client() }
  const result = await account.client.auth.signUp({ email: account.email, password, options: { emailRedirectTo: local.frontend, data: { username: account.username, whatsapp: '+5511999990000' } } })
  check(!result.error && !result.data.session, 'synthetic signup requires email confirmation')
  account.id = result.data.user.id
  return account
}
async function confirm(account) {
  let link
  for (let i = 0; i < 20 && !link; i++) {
    const messages = await (await local.fetch(`${local.mail}/api/v1/messages`)).json()
    const message = messages.messages?.find(m => m.To?.some(to => to.Address === account.email))
    if (message) {
      const content = await (await local.fetch(`${local.mail}/api/v1/message/${message.ID}`)).json()
      link = ((content.Text || content.HTML).match(/https?:\/\/[^\s"<>]+/g) || []).map(x => x.replaceAll('&amp;', '&')).find(x => x.includes('/auth/v1/verify?'))
    }
    if (!link) await new Promise(resolve => setTimeout(resolve, 500))
  }
  check(Boolean(link), 'confirmation delivered only to local Mailpit')
  const response = await local.fetch(link)
  const tokens = new URLSearchParams(localUrl(response.headers.get('location'), 'frontend').hash.slice(1))
  check(Boolean(tokens.get('access_token')), 'local email confirmation completed')
}
try {
  const first = await signup()
  const unconfirmed = await call(first.username)
  check(unconfirmed.status === 401 && unconfirmed.data.code === 'invalid_credentials', 'unconfirmed account denied without disclosing confirmation state')
  await confirm(first)
  for (const [identifier, label] of [[first.email, 'email'], [first.username, 'username'], ['@' + first.username, '@username'], [' @' + first.username.toUpperCase() + ' ', 'normalized uppercase username']]) {
    const response = await call(identifier)
    check(response.status === 200 && Object.keys(response.data).sort().join(',') === 'access_token,refresh_token', `${label} login returns only official tokens`)
    check(!(await first.client.auth.setSession(response.data)).error && (await first.client.auth.getUser()).data.user?.id === first.id, `${label} tokens validated by official Auth for expected user`)
  }
  const failures = []
  for (const identifier of [username(), email(), first.username, first.email]) {
    const r = await call(identifier, 'incorrect-fiction-password')
    check(r.status === 401 && JSON.stringify(r.data) === JSON.stringify(unconfirmed.data), 'unknown account / wrong password have identical status and body')
    check(r.headers.get('cache-control') === 'no-store' && !JSON.stringify(r.data).includes(first.email), 'failed login contains no private email or tokens and is not cached')
    failures.push(r.ms)
  }
  console.log(`Observed failure timings (ms), not a constant-time proof: ${failures.join(', ')}`)
  check((await call('+5511999990000')).status === 401, 'WhatsApp login is not supported')
  const noOrigin = await local.fetch(`${local.api}/functions/v1/password-login`, { method: 'OPTIONS', headers: { origin: local.frontend, 'access-control-request-method': 'POST', 'access-control-request-headers': 'apikey,content-type' } })
  // Local Kong answers OPTIONS before the handler, with its existing wildcard
  // CORS policy. Actual POST origin enforcement is checked separately below.
  check([200, 204].includes(noOrigin.status) && ['*', local.frontend].includes(noOrigin.headers.get('access-control-allow-origin')), 'local browser preflight accepted')
  check((await call(first.username, password, { origin: 'https://fiction.invalid' })).status === 403, 'unexpected browser origin refused')
  // Use the exact frontend integration and official setSession with a new client.
  const signed = local.client()
  let signedIn = false
  const listener = signed.auth.onAuthStateChange(event => { if (event === 'SIGNED_IN') signedIn = true })
  await passwordLogin(signed, first.username, password)
  const session = (await signed.auth.getSession()).data.session
  check(session?.user.id === first.id && signedIn, 'frontend integration installs official session and emits SIGNED_IN')
  const restored = local.client()
  check(!(await restored.auth.setSession(session)).error && (await restored.from('profiles').select('id').single()).data?.id === first.id, 'fresh client restores tokens and can read own profile')
  check(!(await signed.auth.refreshSession()).error, 'official refresh works after server-generated login')
  const current = (await signed.auth.getSession()).data.session
  const second = await signup(); await confirm(second)
  await passwordLogin(second.client, second.username, password)
  const other = await signed.from('profiles').select('phone').eq('id', second.id)
  check(!other.error && other.data.length === 0, 'username session cannot read another reader phone')
  const preferences = await signed.from('feedback_contact_preferences').select('*').eq('user_id', second.id)
  check(!preferences.error && preferences.data.length === 0, 'contact authorization remains isolated')
  check((await signed.rpc('devotional_open_counts')).error?.code === '42501', 'username login grants no administration')
  setLocalAdmin(second.id, true); adminId = second.id
  check(!(await second.client.rpc('devotional_open_counts')).error, 'authorized local admin retains DB-controlled privileges')
  const profiles = await second.client.from('profiles').select('phone').eq('id', first.id)
  check(!profiles.error && profiles.data.length === 0, 'administrator does not gain indiscriminate phone access')
  setLocalAdmin(second.id, false); adminId = undefined
  check((await second.client.rpc('devotional_open_counts')).error?.code === '42501', 'admin revocation remains effective without replacing JWT')
  check(!(await signed.auth.signOut()).error && !(await signed.auth.getSession()).data.session, 'logout removes the official client session')
  const revoke = await local.fetch(`${local.api}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: local.publicKey, 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: current.refresh_token }) })
  check(revoke.status === 400 || revoke.status === 401, 'logout revokes refresh token on Auth server')
  listener.data.subscription.unsubscribe()
  // A NEW synthetic pre-trigger fixture, not a modification/deletion of an
  // existing account. Trigger bypass is transaction-local to this one insert.
  const legacyId = randomUUID(), legacyEmail = email()
  if (!/^selah-login-[0-9a-f-]+@example\.invalid$/.test(legacyEmail) || !/^Fiction-[0-9a-f-]+!$/.test(password)) throw Error('Invalid synthetic fixture')
  local.psql(`begin; set local session_replication_role = replica;
    insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token)
    values ('${legacyId}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${legacyEmail}',extensions.crypt('${password}',extensions.gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','','','','','','','','');
    set local session_replication_role = origin;
    insert into auth.identities(id,provider_id,user_id,identity_data,provider,created_at,updated_at) values ('${randomUUID()}','${legacyId}','${legacyId}','{"sub":"${legacyId}","email":"${legacyEmail}","email_verified":true}','email',now(),now());
    insert into public.profiles(id) values ('${legacyId}'); commit;`)
  const legacy = local.client()
  await passwordLogin(legacy, legacyEmail, password)
  check((await legacy.auth.getSession()).data.session?.user.id === legacyId, 'legacy account without username or WhatsApp still signs in by email')
  check(!(await legacy.from('account_usernames').select('username')).data?.length, 'legacy login does not silently assign a username')
  const name = username()
  const raced = await Promise.all(Array.from({ length: 11 }, (_, i) => call(i % 2 ? '@' + name.toUpperCase() : name, 'fiction-wrong', { 'x-forwarded-for': `192.0.2.${i + 1}` })))
  check(raced.filter(r => r.status === 401).length === 10 && raced.filter(r => r.status === 429).length === 1, 'concurrent attempts share atomic normalized budget despite forged IPs')
  const blocked = await call(name)
  check(blocked.status === 429 && blocked.headers.get('retry-after') === '600' && !JSON.stringify(blocked.data).includes('@'), 'rate limit persists between requests and has no account details')
  for (const client of [first.client, second.client, restored, legacy]) await client.auth.signOut()
  console.log(`${passed} login HTTP checks passed. Three synthetic accounts retained locally; temporary administration revoked. No credentials printed.`)
} catch {
  console.error(`Local login validation stopped at ${stage}; ${passed} checks passed. Remaining checks NOT executed.`)
  process.exitCode = 1
} finally {
  if (adminId) { try { setLocalAdmin(adminId, false) } catch { console.error('Synthetic local administration must be reviewed.'); process.exitCode = 1 } }
}
