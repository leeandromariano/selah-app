import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import postgres from 'npm:postgres@3.4.7'
import { createPasswordLogin, localLoginEnvironment, officialPasswordSession, unavailableLogin } from '../_shared/password-login.ts'

// This entrypoint intentionally refuses hosted projects and arbitrary endpoints.
// The only privileged connection is inside the trusted LOCAL Edge runtime.
try {
  const config = localLoginEnvironment(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_DB_URL'))
  const key = Deno.env.get('SUPABASE_ANON_KEY')
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key || !secret) throw Error('Local runtime unavailable')
  const hmac = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sql = postgres(config.database, { max: 2, prepare: false, connect_timeout: 5, idle_timeout: 20, connection: { statement_timeout: 5000 } })
  const safeFetch: typeof fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.origin !== config.api || url.pathname !== '/auth/v1/token' || url.search !== '?grant_type=password' || url.username || url.password || url.hash) throw Error('Unsupported Auth request')
    return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) })
  }
  Deno.serve(createPasswordLogin({
    async budget(identifier) {
      const signature = await crypto.subtle.sign('HMAC', hmac, new TextEncoder().encode(`password-login-v1:${identifier}`))
      const digest = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('')
      const rows = await sql`select private.consume_password_login_attempt(${digest}) as allowed`
      return rows[0]?.allowed === true
    },
    async resolve(username) {
      const rows = await sql`select u.email from public.account_usernames n join auth.users u on u.id = n.user_id where n.username = ${username} limit 1`
      return rows[0]?.email || null
    },
    async authenticate(email, password) {
      const client = createClient(config.api, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: safeFetch } })
      return officialPasswordSession(await client.auth.signInWithPassword({ email, password }))
    },
    dummyEmail: () => `unknown-${crypto.randomUUID()}@example.invalid`,
  }))
} catch {
  Deno.serve(() => Response.json(unavailableLogin, { status: 503, headers: { 'Cache-Control': 'no-store' } }))
}
