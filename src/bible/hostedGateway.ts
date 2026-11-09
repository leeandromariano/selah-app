import { bibleGateway } from './apiGateway'

// Interface kept deliberately small so the hosted boundary can be tested
// without Cloudflare, Supabase or real credentials.
export type BibleQuota = {
  consume(bucket: string, maximum: number): Promise<boolean>
}
export type HostedBibleOptions = {
  apiKey?: string
  supabaseUrl?: string
  supabasePublicKey?: string
  siteOrigin?: string
  additionalSiteOrigin?: string
  quota?: BibleQuota
  fetcher?: typeof fetch
  now?: Date
}
const failure = (status: number) => Response.json({ error: 'Bíblia indisponível.' }, { status, headers: { 'Cache-Control': 'no-store' } })
function validAdditionalOrigin(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.origin === value && !url.username && !url.password && !url.port && url.hostname.includes('.') && !url.hostname.endsWith('.local')
  } catch { return false }
}

export async function hostedBibleGateway(request: Request, options: HostedBibleOptions): Promise<Response> {
  const { apiKey, supabaseUrl, supabasePublicKey, siteOrigin, additionalSiteOrigin, quota, fetcher = fetch, now = new Date() } = options
  if (!apiKey || !supabasePublicKey || !quota || !siteOrigin || !supabaseUrl || !/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(supabaseUrl)) return failure(503)
  if (additionalSiteOrigin && !validAdditionalOrigin(additionalSiteOrigin)) return failure(503)
  const url = new URL(request.url)
  if (![siteOrigin, additionalSiteOrigin].includes(url.origin) || request.method !== 'GET' || request.headers.get('origin') && request.headers.get('origin') !== url.origin || !['same-origin', 'none', null].includes(request.headers.get('sec-fetch-site'))) return failure(403)
  const authorization = request.headers.get('authorization')
  if (!authorization || !/^Bearer [A-Za-z0-9._-]+$/.test(authorization)) return failure(401)
  try {
    // Validate the access token with Supabase Auth, not decoded user metadata.
    const userResponse = await fetcher(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authorization, apikey: supabasePublicKey }, redirect: 'manual' })
    if (!userResponse.ok) return failure(401)
    const user = await userResponse.json() as { id?: unknown }
    if (typeof user.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(user.id)) return failure(401)
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(user.id))
    const account = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    const minute = now.toISOString().slice(0, 16), day = now.toISOString().slice(0, 10)
    if (!await quota.consume(`user:${account}:${minute}`, 20) || !await quota.consume(`day:${day}`, 100)) return failure(429)
    return await bibleGateway(request, { apiKey, fetcher })
  } catch {
    return failure(503)
  }
}
