import type { SupabaseClient } from '@supabase/supabase-js'

export function normalizeLoginIdentifier(input: string) {
  const value = input.trim().toLowerCase()
  if (value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return value
  const username = value.startsWith('@') ? value.slice(1) : value
  if (/^[a-z][a-z0-9_]{2,23}$/.test(username)) return username
  throw { code: 'invalid_identifier' }
}

export async function passwordLogin(client: Pick<SupabaseClient, 'auth' | 'functions'>, identifier: string, password: string) {
  const { data, error } = await client.functions.invoke('password-login', { body: { identifier: normalizeLoginIdentifier(identifier), password } })
  if (error) {
    // Never display arbitrary server diagnostics or resolved account details.
    const status = (error as { context?: { status?: number } }).context?.status
    throw { code: status === 401 ? 'invalid_credentials' : status === 429 ? 'over_request_rate_limit' : 'login_unavailable' }
  }
  if (typeof data?.access_token !== 'string' || !data.access_token || typeof data?.refresh_token !== 'string' || !data.refresh_token) throw { code: 'login_unavailable' }
  // Official SDK validates the tokens via Auth, persists the session and emits
  // SIGNED_IN. The application keeps its existing session/refresh/logout flow.
  const result = await client.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
  if (result.error || !result.data.session) throw { code: 'login_unavailable' }
}
