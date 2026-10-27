import { prepareLocalScript, localUrl } from './local-environment.mjs'
// Explicit, opt-in HTTP integration check. Never part of Vitest/build/lint.
// Creates one synthetic local account and retains it for inspection; no deletion.
import { randomUUID } from 'node:crypto'

const local = prepareLocalScript()
const { api, mail } = local
let passed = 0
function check(ok, label) { if (!ok) throw new Error(label); passed++; console.log(`PASS ${label}`) }

async function request(url, options) { return local.fetch(url, options) }
check(api === 'http://127.0.0.1:54321', 'local API target verified')
const client = local.client()
const email = `selah-test-${randomUUID()}@example.invalid`
const password = `Test-${randomUUID()}!`
const replacement = `Test-${randomUUID()}!`
async function emailLink(type) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await request(`${mail}/api/v1/messages`)
    if (!response.ok) throw new Error('Mailpit API unavailable')
    const list = await response.json()
    const message = list.messages?.find(m => m.To?.some(to => to.Address === email) && (type === 'signup' ? /confirm/i : /reset|recover/i).test(m.Subject))
    if (message) {
      const detail = await (await request(`${mail}/api/v1/message/${message.ID}`)).json()
      const content = detail.Text || detail.HTML
      const links = content.match(/https?:\/\/[^\s"<>]+/g) || []
      const link = links.map(s => s.replaceAll('&amp;', '&')).find(s => s.includes('/auth/v1/verify?'))
      if (link) return localUrl(link, 'api')
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error('Synthetic email not received in Mailpit')
}
async function verify(link) {
  const response = await request(link)
  const destination = localUrl(response.headers.get('location'), 'frontend')
  const tokens = new URLSearchParams(destination.hash.slice(1))
  check(Boolean(tokens.get('access_token') && tokens.get('refresh_token')), 'email verification issued a session')
  const result = await client.auth.setSession({ access_token: tokens.get('access_token'), refresh_token: tokens.get('refresh_token') })
  check(!result.error, 'SDK accepted verified local session')
  return tokens
}
try {
  const signup = await client.auth.signUp({ email, password, options: { emailRedirectTo: 'http://127.0.0.1:5173', data: { username: 'u' + randomUUID().replaceAll('-', '').slice(0,20) } } })
  check(!signup.error && signup.data.user && !signup.data.session, 'signup requires email confirmation')
  const unconfirmed = await client.auth.signInWithPassword({ email, password })
  check(unconfirmed.error?.code === 'email_not_confirmed', 'unconfirmed login rejected')
  await verify(await emailLink('signup'))
  check(!(await client.auth.signOut()).error, 'confirmed session logout')
  const bad = await client.auth.signInWithPassword({ email, password: 'wrong-fictional-password' })
  check(bad.error?.code === 'invalid_credentials', 'invalid password rejected')
  check(!(await client.auth.signInWithPassword({ email, password })).error, 'confirmed login succeeds')
  const metrics = await client.rpc('devotional_open_counts')
  check(metrics.error?.code === '42501', 'reader denied administrative metrics via HTTP')
  const session = (await client.auth.getSession()).data.session
  const restored = local.client()
  check(!(await restored.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })).error, 'session restored in another SDK instance')
  check(!(await client.auth.resetPasswordForEmail(email, { redirectTo: 'http://127.0.0.1:5173' })).error, 'recovery email requested')
  const recovery = await verify(await emailLink('recovery'))
  check(recovery.get('type') === 'recovery', 'recovery redirect identified')
  check(!(await client.auth.updateUser({ password: replacement })).error, 'password updated with recovered session')
  check(!(await client.auth.signOut()).error, 'recovered session logout')
  check(Boolean((await client.auth.signInWithPassword({ email, password })).error), 'old password rejected')
  check(!(await client.auth.signInWithPassword({ email, password: replacement })).error, 'new password login succeeds')
  check(!(await client.auth.signOut()).error, 'final logout')
  console.log(`${passed} HTTP checks passed. Synthetic account retained locally; no secrets printed.`)
} catch (error) {
  console.error(`HTTP validation stopped after ${passed} passed checks: ${error.message?.startsWith('Non-local') ? 'Non-local URL rejected' : 'a required check failed'}. Remaining checks NOT executed.`)
  process.exitCode = 1
}
