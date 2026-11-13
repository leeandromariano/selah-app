import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import postgres from 'npm:postgres@3.4.7'
import { allowedOrigins, createPasswordLogin, hostedLoginEnvironment, localLoginEnvironment, officialPasswordSession, unavailableLogin } from '../_shared/password-login.ts'

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
async function hmacKey(secret: string) {
  return await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}
const digest = async (hmac: CryptoKey, identifier: string) => hex(await crypto.subtle.sign('HMAC', hmac, new TextEncoder().encode(`password-login-v1:${identifier}`)))
const urlOf = (input: string | URL | Request) => new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
const dummyEmail = () => `unknown-${crypto.randomUUID()}@example.invalid`

// Local: conexão PostgreSQL do runtime local (somente containers do desenvolvimento).
async function localDependencies() {
  const config = localLoginEnvironment(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_DB_URL'))
  const key = Deno.env.get('SUPABASE_ANON_KEY')
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key || !secret) throw Error('Local runtime unavailable')
  const hmac = await hmacKey(secret)
  const sql = postgres(config.database, { max: 2, prepare: false, connect_timeout: 5, idle_timeout: 20, connection: { statement_timeout: 5000 } })
  const safeFetch: typeof fetch = (input, init) => {
    const url = urlOf(input)
    if (url.origin !== config.api || url.pathname !== '/auth/v1/token' || url.search !== '?grant_type=password' || url.username || url.password || url.hash) throw Error('Unsupported Auth request')
    return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) })
  }
  return {
    async budget(identifier: string) {
      const rows = await sql`select private.consume_password_login_attempt(${await digest(hmac, identifier)}) as allowed`
      return rows[0]?.allowed === true
    },
    async resolve(username: string) {
      const rows = await sql`select u.email from public.account_usernames n join auth.users u on u.id = n.user_id where n.username = ${username} limit 1`
      return rows[0]?.email || null
    },
    async authenticate(email: string, password: string) {
      const client = createClient(config.api, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: safeFetch } })
      return officialPasswordSession(await client.auth.signInWithPassword({ email, password }))
    },
    dummyEmail,
  }
}

// Hospedado: sem conexão direta ao banco. A chave de serviço do próprio runtime só chama as duas funções
// login_resolve_username e login_consume_attempt (executáveis apenas por service_role) e o Auth oficial valida a senha.
async function hostedDependencies() {
  const config = hostedLoginEnvironment(Deno.env.get('SUPABASE_URL'))
  const key = Deno.env.get('SUPABASE_ANON_KEY')
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key || !secret) throw Error('Hosted runtime unavailable')
  const hmac = await hmacKey(secret)
  const guarded = (allowed: (url: URL) => boolean): typeof fetch => (input, init) => {
    const url = urlOf(input)
    if (url.origin !== config.api || url.username || url.password || url.hash || !allowed(url)) throw Error('Unsupported request')
    return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) })
  }
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  const admin = createClient(config.api, secret, { ...options, global: { fetch: guarded(url => url.pathname === '/rest/v1/rpc/login_resolve_username' || url.pathname === '/rest/v1/rpc/login_consume_attempt') } })
  const authFetch = guarded(url => url.pathname === '/auth/v1/token' && url.search === '?grant_type=password')
  return {
    origins: allowedOrigins(Deno.env.get('SELAH_ALLOWED_ORIGINS')),
    async budget(identifier: string) {
      const { data, error } = await admin.rpc('login_consume_attempt', { p_bucket: await digest(hmac, identifier) })
      if (error) throw Error('Budget unavailable')
      return data === true
    },
    async resolve(username: string) {
      const { data, error } = await admin.rpc('login_resolve_username', { p_username: username })
      if (error) throw Error('Resolution unavailable')
      return typeof data === 'string' && data ? data : null
    },
    async authenticate(email: string, password: string) {
      const client = createClient(config.api, key, { ...options, global: { fetch: authFetch } })
      return officialPasswordSession(await client.auth.signInWithPassword({ email, password }))
    },
    dummyEmail,
  }
}

// Recusa qualquer destino que não seja o runtime local ou um projeto Supabase hospedado.
try {
  let dependencies
  try { dependencies = await localDependencies() } catch { dependencies = await hostedDependencies() }
  Deno.serve(createPasswordLogin(dependencies))
} catch {
  Deno.serve(() => Response.json(unavailableLogin, { status: 503, headers: { 'Cache-Control': 'no-store' } }))
}
