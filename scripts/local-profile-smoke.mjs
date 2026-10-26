// Opt-in local HTTP integration. Two synthetic accounts remain locally; no reset/delete.
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createProfileRepository } from '../src/profiles/profile.ts'

const api = 'http://127.0.0.1:54321'
const mail = 'http://127.0.0.1:54324'
const status = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8' })
if (status.status !== 0) { console.error('Local status unavailable; no profile HTTP tests executed.'); process.exit(1) }
const config = JSON.parse(status.stdout)
if (config.API_URL !== api) { console.error('Unexpected API target; tests aborted.'); process.exit(1) }
const key = config.PUBLISHABLE_KEY || config.ANON_KEY
if (!key || key.startsWith('sb_secret_')) throw new Error('Local public key unavailable')
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const makeClient = () => createClient(api, key, options)
let passed = 0
let stage = 'synthetic signup'
function check(ok, label) { stage = label; if (!ok) throw new Error('check failed'); passed++; console.log(`PASS ${label}`) }
function localUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || !['54321', '54324', '5173'].includes(url.port)) throw new Error('non-local URL')
  return url
}
async function request(url) { return fetch(localUrl(url), { redirect: 'manual' }) }
async function reader() {
  const client = makeClient()
  const email = `selah-profile-${randomUUID()}@example.invalid`
  const password = `Fiction-${randomUUID()}!`
  const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: 'http://127.0.0.1:5173', data: { role: 'admin', profile: { name: 'Leitor Fictício', phone: '+5511999990000', age_range: '25_34', instagram: null } } } })
  check(!error && data.user && !data.session, 'synthetic reader awaits confirmation')
  let link
  for (let attempt = 0; attempt < 20 && !link; attempt++) {
    const list = await (await request(`${mail}/api/v1/messages`)).json()
    const message = list.messages?.find(m => m.To?.some(to => to.Address === email))
    if (message) {
      const detail = await (await request(`${mail}/api/v1/message/${message.ID}`)).json()
      link = ((detail.Text || detail.HTML).match(/https?:\/\/[^\s"<>]+/g) || []).map(s => s.replaceAll('&amp;', '&')).find(s => s.includes('/auth/v1/verify?'))
    }
    if (!link) await new Promise(resolve => setTimeout(resolve, 500))
  }
  check(Boolean(link), 'synthetic confirmation received in local Mailpit')
  const response = await request(link)
  const destination = localUrl(response.headers.get('location'))
  const tokens = new URLSearchParams(destination.hash.slice(1))
  const confirmed = await client.auth.setSession({ access_token: tokens.get('access_token'), refresh_token: tokens.get('refresh_token') })
  check(!confirmed.error && confirmed.data.user.id === data.user.id, 'synthetic reader confirmed with own session')
  return { client, id: data.user.id, email, password, repository: createProfileRepository(client) }
}
try {
  const first = await reader()
  const second = await reader()
  stage = 'profile creation using public session'
  check(await first.repository.load(first.id) === null, 'missing profile returns null')
  const original = await first.repository.save(first.id, { name: 'Primeiro Leitor Fictício', phone: '(11) 99999-0000', age_range: '25_34', instagram: '@leitor.ficticio' }, false)
  check(original.id === first.id && original.phone === '+5511999990000', 'profile created for authenticated auth.users.id')
  check(Boolean(original.created_at && original.updated_at), 'server supplies profile timestamps')
  await second.repository.save(second.id, { name: 'Segundo Leitor Fictício', phone: null, age_range: '35_44', instagram: null }, false)
  const edited = await first.repository.save(first.id, { name: 'Nome Fictício Atualizado', phone: null, age_range: '45_59', instagram: null, id: second.id, created_at: '2000-01-01', role: 'admin' }, true)
  check(edited.id === first.id && edited.name === 'Nome Fictício Atualizado' && edited.phone === null && edited.instagram === null && edited.age_range === '45_59', 'update persists allowed fields only')
  check(edited.created_at === original.created_at && new Date(edited.updated_at) > new Date(original.updated_at), 'trigger advances updated_at and preserves created_at')
  const tokens = (await first.client.auth.getSession()).data.session
  const reloaded = makeClient()
  const restoration = await reloaded.auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token })
  check(!restoration.error, 'session restored into fresh SDK instance')
  const afterReload = await createProfileRepository(reloaded).load(first.id)
  check(afterReload.name === edited.name && afterReload.age_range === edited.age_range, 'fresh client reads saved PostgreSQL profile')
  const otherRead = await first.client.from('profiles').select('*').eq('id', second.id)
  check(!otherRead.error && otherRead.data.length === 0, 'RLS hides other reader profile')
  const list = await first.client.from('profiles').select('id')
  check(!list.error && list.data.length === 1 && list.data[0].id === first.id, 'unfiltered query returns only own profile')
  const otherUpdate = await first.client.from('profiles').update({ name: 'Tentativa Fictícia' }).eq('id', second.id).select('id')
  check(!otherUpdate.error && otherUpdate.data.length === 0, 'RLS updates zero rows for other reader')
  check((await second.repository.load(second.id)).name === 'Segundo Leitor Fictício', 'other reader profile remains unchanged')
  const forgedInsert = await first.client.from('profiles').insert({ id: second.id, name: 'Tentativa Fictícia' })
  check(forgedInsert.error?.code === '42501', 'forged profile ownership rejected')
  for (const [column, value] of [['id', second.id], ['created_at', '2000-01-01T00:00:00Z'], ['updated_at', '2000-01-01T00:00:00Z']]) {
    const result = await first.client.from('profiles').update({ [column]: value }).eq('id', first.id)
    check(result.error?.code === '42501', `protected column ${column} update denied`)
  }
  const forgedTime = await first.client.from('profiles').insert({ id: first.id, name: 'Tentativa', created_at: '2000-01-01T00:00:00Z' })
  check(forgedTime.error?.code === '42501', 'client supplied creation timestamp denied')
  const invalid = await first.client.from('profiles').update({ age_range: 'invalid' }).eq('id', first.id)
  check(invalid.error?.code === '23514', 'database rejects invalid age range')
  const metrics = await first.client.rpc('devotional_open_counts')
  check(metrics.error?.code === '42501', 'signup metadata does not confer administration')
  check(!(await first.client.auth.signOut()).error, 'reader logout succeeds')
  check((await first.client.from('profiles').select('id')).error?.code === '42501', 'anonymous profile read denied after logout')
  check(!(await first.client.auth.signInWithPassword({ email: first.email, password: first.password })).error, 'reader logs in again')
  const afterLogin = await first.repository.load(first.id)
  check(afterLogin.name === edited.name && afterLogin.created_at === original.created_at, 'saved profile survives logout and new login')
  check(!(await first.client.auth.signOut()).error && !(await second.client.auth.signOut()).error, 'test readers logged out')
  console.log(`${passed} profile HTTP checks passed. Two synthetic local accounts retained; no secrets printed.`)
} catch {
  console.error(`Profile HTTP validation stopped at ${stage}; ${passed} passed. Remaining checks NOT executed.`)
  process.exitCode = 1
}
