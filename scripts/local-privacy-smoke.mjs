// Opt-in, guarded local integration. Retains two synthetic accounts; deletes nothing.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { prepareLocalScript, localUrl } from './local-environment.mjs'
import { createProfileRepository } from '../src/profiles/profile.ts'
import { createPrivacyRepository } from '../src/profiles/privacy.ts'
const local = prepareLocalScript()
if (['--sql', '--inventory'].includes(process.argv[2])) {
  try {
    const file = process.argv[2] === '--sql' ? 'supabase/tests/privacy-essential.sql' : 'supabase/tests/privacy-inventory.sql'
    process.stdout.write(local.psql(readFileSync(file, 'utf8')))
  } catch { console.error('Local privacy SQL failed; validation incomplete. No credentials printed.'); process.exit(1) }
  process.exit(0)
}
let passed = 0
let stage = 'setup'
function check(ok, label) { stage = label; if (!ok) throw Error('check failed'); passed++; console.log(`PASS ${label}`) }
async function reader() {
  const client = local.client()
  const email = `selah-privacy-${randomUUID()}@example.invalid`
  const password = `Fiction-${randomUUID()}!`
  const signup = await client.auth.signUp({ email, password, options: { emailRedirectTo: local.frontend, data: { username: 'u' + randomUUID().replaceAll('-', '').slice(0,20) } } })
  check(!signup.error && signup.data.user && !signup.data.session, 'minimal signup awaits confirmation')
  check(!['profile', 'name', 'phone', 'age', 'age_range', 'instagram', 'role'].some(key => key in signup.data.user.user_metadata), 'no personal profile draft or role stored by minimal signup')
  let link
  for (let attempt = 0; attempt < 20 && !link; attempt++) {
    const list = await (await local.fetch(`${local.mail}/api/v1/messages`)).json()
    const message = list.messages?.find(m => m.To?.some(to => to.Address === email))
    if (message) {
      const detail = await (await local.fetch(`${local.mail}/api/v1/message/${message.ID}`)).json()
      link = ((detail.Text || detail.HTML).match(/https?:\/\/[^\s"<>]+/g) || []).map(value => value.replaceAll('&amp;', '&')).find(value => value.includes('/auth/v1/verify?'))
    }
    if (!link) await new Promise(resolve => setTimeout(resolve, 500))
  }
  check(Boolean(link), 'confirmation delivered to local Mailpit')
  const response = await local.fetch(link)
  const tokens = new URLSearchParams(localUrl(response.headers.get('location'), 'frontend').hash.slice(1))
  check(!(await client.auth.setSession({ access_token: tokens.get('access_token'), refresh_token: tokens.get('refresh_token') })).error, 'minimal account confirmed')
  return { client, email, password, id: signup.data.user.id, profile: createProfileRepository(client), privacy: createPrivacyRepository(client) }
}
try {
  const first = await reader(), second = await reader()
  check(await first.profile.load(first.id) === null, 'no profile automatically created')
  const blank = { name: '', phone: null, age_range: null, instagram: null }
  const saved = await first.profile.save(first.id, blank, false)
  check(saved.name === null && saved.phone === null && saved.age_range === null && saved.instagram === null, 'all optional profile fields saved as null')
  const edited = await first.profile.save(first.id, { ...blank, name: 'Apelido Fictício' }, true)
  check(edited.name === 'Apelido Fictício', 'display name correction persists')
  check((await first.profile.save(first.id, blank, true)).name === null, 'display name can be cleared without deleting profile')
  check(await second.profile.load(first.id) === null, 'other user profile remains hidden by RLS')
  const otherUpdate = await second.client.from('profiles').update({ name: 'Tentativa fictícia' }).eq('id', first.id).select('id')
  check(!otherUpdate.error && otherUpdate.data.length === 0, 'other user cannot correct profile')
  check(await first.privacy.load(first.id) === null, 'no request before explicit action')
  let rejected = false
  try { await first.privacy.request(first.id, false) } catch { rejected = true }
  check(rejected && await first.privacy.load(first.id) === null, 'unconfirmed request does not write')
  const request = await first.privacy.request(first.id, true)
  check(request.user_id === first.id && Boolean(request.requested_at), 'confirmed own request persists with server timestamp')
  check((await first.privacy.request(first.id, true)).requested_at === request.requested_at, 'duplicate request preserves original timestamp')
  const hidden = await second.client.from('account_deletion_requests').select('*').eq('user_id', first.id)
  check(!hidden.error && hidden.data.length === 0, 'other user request hidden through direct API')
  const forged = await second.client.from('account_deletion_requests').insert({ user_id: first.id })
  check(forged.error?.code === '42501', 'forged request ownership denied')
  const time = await second.client.from('account_deletion_requests').insert({ user_id: second.id, requested_at: '2000-01-01T00:00:00Z' })
  check(time.error?.code === '42501', 'client timestamp injection denied')
  const update = await first.client.from('account_deletion_requests').update({ requested_at: '2000-01-01T00:00:00Z' }).eq('user_id', first.id)
  check(update.error?.code === '42501', 'request timestamp update denied')
  const anonymous = await local.client().from('account_deletion_requests').select('*')
  check(anonymous.error?.code === '42501', 'anonymous request access denied')
  const ownAccount = await first.client.auth.getUser()
  check(!ownAccount.error && ownAccount.data.user.id === first.id && (await first.profile.load(first.id))?.id === first.id, 'request does not delete account or profile')
  check((await first.client.rpc('devotional_open_counts')).error?.code === '42501', 'privacy action grants no administrative privilege')
  check(!(await first.client.auth.signOut()).error && !(await first.client.auth.signInWithPassword({ email: first.email, password: first.password })).error, 'request leaves login and logout functional')
  check((await first.privacy.load(first.id))?.requested_at === request.requested_at && (await first.profile.load(first.id))?.name === null, 'request and empty display name persist after new login')
  const tokens = (await first.client.auth.getSession()).data.session
  const fresh = local.client()
  check(!(await fresh.auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token })).error, 'session restored in fresh client')
  check((await createPrivacyRepository(fresh).load(first.id))?.requested_at === request.requested_at, 'request persists in fresh client')
  check(!(await first.client.auth.signOut()).error && !(await second.client.auth.signOut()).error, 'synthetic clients signed out')
  console.log(`${passed} privacy HTTP checks passed. Two synthetic local accounts and one request retained. No deletion or credentials printed.`)
} catch {
  console.error(`Local privacy validation stopped at ${stage}; ${passed} checks passed. Remaining checks NOT executed.`)
  process.exitCode = 1
}
