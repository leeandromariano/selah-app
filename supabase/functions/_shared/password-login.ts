// Runtime independent: tested without network, Deno, credentials or real clients.
export const invalidLogin = { code: 'invalid_credentials', message: 'Usuário, e-mail ou senha inválidos. Confira os dados e a confirmação do e-mail.' }
export const limitedLogin = { code: 'over_request_rate_limit', message: 'Muitas tentativas. Aguarde e tente novamente.' }
export const unavailableLogin = { code: 'login_unavailable', message: 'Não foi possível entrar. Tente novamente mais tarde.' }
const origins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://localhost:4173'])

export function officialPasswordSession(result: {
  data: { session: { access_token: string; refresh_token: string } | null }
  error: { status?: number } | null
}) {
  const { data, error } = result
  if (error) {
    const status = error.status
    // auth-js uses status 0 for transport errors (including timeouts). Do not
    // misreport an unavailable verifier as an invalid password or expose details.
    if (typeof status !== 'number' || !Number.isInteger(status) || status < 400 || status === 429 || status >= 500) throw Error('Auth temporarily unavailable')
    return null
  }
  const session = data?.session
  if (!session?.access_token || !session?.refresh_token) throw Error('Unexpected Auth response')
  return { access_token: session.access_token, refresh_token: session.refresh_token }
}

export function loginIdentifier(input: unknown) {
  if (typeof input !== 'string' || input.length > 254) return null
  const value = input.trim().toLowerCase()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { kind: 'email' as const, value }
  const username = value.startsWith('@') ? value.slice(1) : value
  if (/^[a-z][a-z0-9_]{2,23}$/.test(username)) return { kind: 'username' as const, value: username }
  return null
}

export function localLoginEnvironment(api: string | undefined, database: string | undefined) {
  const auth = new URL(api || '')
  const db = new URL(database || '')
  if (auth.protocol !== 'http:' || !['kong', 'supabase_kong_devocionais-app'].includes(auth.hostname) || auth.port !== '8000' || auth.pathname !== '/' || auth.username || auth.password || auth.search || auth.hash) throw Error('Local Auth required')
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || !['db', 'supabase_db_devocionais-app'].includes(db.hostname) || db.port !== '5432' || db.pathname !== '/postgres' || db.username !== 'postgres' || !db.password || db.search || db.hash) throw Error('Local database required')
  return { api: auth.origin, database: db.href }
}

// Projeto hospedado: https://<ref de 20 letras/números>.supabase.co, sem caminho, credenciais ou parâmetros.
export function hostedLoginEnvironment(api: string | undefined) {
  const auth = new URL(api || '')
  if (auth.protocol !== 'https:' || !/^[a-z0-9]{20}\.supabase\.co$/.test(auth.hostname) || auth.port || auth.pathname !== '/' || auth.username || auth.password || auth.search || auth.hash) throw Error('Hosted Auth required')
  return { api: auth.origin }
}

// Origens de navegador aceitas no hospedado. Padrão: o domínio do Coram; SELAH_ALLOWED_ORIGINS (separadas por vírgula) substitui.
export function allowedOrigins(configured: string | undefined) {
  const fallback = ['https://appcoram.com.br', 'https://www.appcoram.com.br']
  const parsed = (configured ? configured.split(',') : fallback).map(item => item.trim()).filter(Boolean).flatMap(item => {
    try { const url = new URL(item); return url.protocol === 'https:' && url.origin === item && !url.username && !url.password ? [url.origin] : [] } catch { return [] }
  })
  return new Set(parsed.length ? parsed : fallback)
}

type Dependencies = {
  origins?: Set<string>
  budget: (identifier: string) => Promise<boolean>
  resolve: (username: string) => Promise<string | null>
  authenticate: (email: string, password: string) => Promise<{ access_token: string; refresh_token: string } | null>
  dummyEmail: () => string
  now?: () => number
  pause?: (ms: number) => Promise<void>
  jitter?: () => number
}

export function createPasswordLogin(dependencies: Dependencies) {
  const now = dependencies.now || Date.now
  const pause = dependencies.pause || (ms => new Promise(resolve => setTimeout(resolve, ms)))
  return async (request: Request) => {
    const start = now()
    const allowed = dependencies.origins || origins
    const origin = request.headers.get('origin')
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Pragma': 'no-cache', 'Vary': 'Origin' }
    if (origin && allowed.has(origin)) {
      headers['Access-Control-Allow-Origin'] = origin
      headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info'
      headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    }
    const reply = (body: object, status: number) => new Response(JSON.stringify(body), { status, headers })
    // Origin is a browser restriction, not authentication. CLI callers can omit it.
    if (origin && !allowed.has(origin)) return reply(unavailableLogin, 403)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply(unavailableLogin, 405)
    const invalid = async () => {
      // Equal floor + jitter reduces obvious differences; not constant-time auth.
      const floor = 700 + Math.min(150, Math.max(0, dependencies.jitter?.() ?? Math.random() * 150))
      await pause(Math.max(0, floor - (now() - start)))
      return reply(invalidLogin, 401)
    }
    try {
      // Bound reads even with chunked bodies or forged Content-Length.
      const reader = request.body?.getReader()
      if (!reader) return await invalid()
      let length = 0, text = ''
      const decoder = new TextDecoder()
      while (true) {
        const part = await reader.read()
        if (part.done) break
        length += part.value.byteLength
        if (length > 4096) { await reader.cancel(); return await invalid() }
        text += decoder.decode(part.value, { stream: true })
      }
      text += decoder.decode()
      let input
      try { input = JSON.parse(text) } catch { return await invalid() }
      const identifier = loginIdentifier(input?.identifier)
      // Malformed requests also share a persistent budget.
      if (!await dependencies.budget(identifier ? `${identifier.kind}:${identifier.value}` : 'malformed')) {
        headers['Retry-After'] = '600'
        return reply(limitedLogin, 429)
      }
      if (!identifier || typeof input?.password !== 'string' || !input.password || input.password.length > 1024) return await invalid()
      const email = identifier.kind === 'email' ? identifier.value : await dependencies.resolve(identifier.value)
      // Unknown usernames still reach the official password verifier with a
      // random, non-existent synthetic address. No account details escape.
      const session = await dependencies.authenticate(email || dependencies.dummyEmail(), input.password)
      if (!email || !session) return await invalid()
      // Only official session tokens, never a resolved email / lookup result.
      return reply({ access_token: session.access_token, refresh_token: session.refresh_token }, 200)
    } catch {
      // No diagnostics, request bodies, identifiers, tokens or passwords logged.
      return reply(unavailableLogin, 503)
    }
  }
}
