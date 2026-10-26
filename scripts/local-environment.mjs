import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { localDocker } from './local-docker.mjs'

const definitions = {
  api: { protocol: 'http:', port: '54321' },
  mail: { protocol: 'http:', port: '54324' },
  frontend: { protocol: 'http:', port: '5173' },
  studio: { protocol: 'http:', port: '54323' },
  database: { protocol: 'postgresql:', port: '54322' },
}
export function localUrl(value, role, { root = false } = {}) {
  const definition = definitions[role]
  let url
  try { url = new URL(value) } catch { throw new Error('Invalid local URL') }
  if (!definition || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.port !== definition.port || (role === 'database' ? !['postgres:', 'postgresql:'].includes(url.protocol) : url.protocol !== definition.protocol)) throw new Error('Non-local or unsupported target rejected')
  if (role === 'database') {
    if (url.pathname !== '/postgres' || url.search || url.hash) throw new Error('Unsupported local database target')
  } else if (url.username || url.password || (root && (url.pathname !== '/' || url.search || url.hash))) throw new Error('Unexpected local URL credentials or path')
  // Do not rely on DNS/hosts resolution for localhost when issuing a request.
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1'
  return url
}

export function validateLocalEnvironment(environment) {
  for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
    if (environment[name]) throw new Error('Proxy configuration is not allowed in local scripts')
  }
  for (const name of ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'API_URL']) if (environment[name]) localUrl(environment[name], 'api', { root: true })
  for (const name of ['DATABASE_URL', 'SUPABASE_DB_URL', 'DB_URL']) if (environment[name]) localUrl(environment[name], 'database')
  for (const name of ['PGHOST', 'PGHOSTADDR']) if (environment[name] && !['127.0.0.1', 'localhost', '::1', '/var/run/postgresql'].includes(environment[name])) throw new Error('Non-local PostgreSQL override rejected')
  if (environment.PGPORT && !['5432', '54322'].includes(environment.PGPORT)) throw new Error('Unexpected PostgreSQL port')
  if (environment.PGDATABASE && environment.PGDATABASE !== 'postgres') throw new Error('Unexpected PostgreSQL database')
  if (environment.PGSERVICE || environment.PGSERVICEFILE) throw new Error('PostgreSQL service overrides are not allowed')
}

export function localFetch(transport = globalThis.fetch, environment = process.env) {
  validateLocalEnvironment(environment)
  return async (input, init = {}) => {
    validateLocalEnvironment(environment)
    const request = new Request(input, { ...init, redirect: 'manual' })
    const parsed = new URL(request.url)
    const role = parsed.port === '54321' ? 'api' : parsed.port === '54324' ? 'mail' : null
    const target = localUrl(request.url, role)
    // Native fetch receives only a validated literal loopback URL. Never follow 3xx.
    if (target.href === request.url) return transport(request)
    return transport(new Request(target.href, {
      method: request.method, headers: request.headers, redirect: 'manual',
      signal: request.signal,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
    }))
  }
}

export function openLocalEnvironment({ run = spawnSync, environment = process.env, transport = globalThis.fetch } = {}) {
  validateLocalEnvironment(environment)
  const docker = localDocker(run, environment)
  const status = run(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8', env: docker.env })
  if (status.status !== 0) throw new Error('Local Supabase status unavailable')
  let config
  try { config = JSON.parse(status.stdout) } catch { throw new Error('Invalid local Supabase status') }
  const api = localUrl(config.API_URL, 'api', { root: true }).origin
  localUrl(config.DB_URL, 'database')
  // Every advertised status URL must also remain on an explicitly permitted local service.
  for (const [name, value] of Object.entries(config)) {
    if (!name.endsWith('_URL')) continue
    if (name === 'DB_URL') { localUrl(value, 'database'); continue }
    let port
    try { port = new URL(value).port } catch { throw new Error('Invalid status service URL') }
    localUrl(value, port === '54321' ? 'api' : port === '54324' ? 'mail' : port === '54323' ? 'studio' : null)
  }
  const publicKey = config.PUBLISHABLE_KEY || config.ANON_KEY
  if (typeof publicKey !== 'string' || /[\r\n]/.test(publicKey)) throw new Error('Local public key unavailable')
  if (!publicKey.startsWith('sb_publishable_')) {
    let role
    try { role = JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url').toString()).role } catch { /* fail closed */ }
    if (role !== 'anon') throw new Error('Only a local public key is allowed')
  }
  for (const [container, internal, external] of [['supabase_db_devocionais-app', '5432/tcp', '54322'], ['supabase_kong_devocionais-app', '8000/tcp', '54321'], ['supabase_inbucket_devocionais-app', '8025/tcp', '54324']]) {
    const result = docker.run(['port', container, internal], { encoding: 'utf8' })
    if (result.status !== 0 || !result.stdout.split(/\r?\n/).some(line => ['0.0.0.0', '127.0.0.1', '[::]', '[::1]'].some(host => line === `${host}:${external}`))) throw new Error('Local container mapping not verified')
  }
  const fetch = localFetch(transport, environment)
  return {
    api, mail: 'http://127.0.0.1:54324', frontend: 'http://127.0.0.1:5173', publicKey, docker, fetch,
    client() {
      return createClient(api, publicKey, { global: { fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    },
    psql(sql) {
      validateLocalEnvironment(environment)
      const result = docker.run(['exec', '-i', 'supabase_db_devocionais-app', 'psql', '-X', '-h', '/var/run/postgresql', '-p', '5432', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' })
      if (result.status !== 0) throw new Error('Local PostgreSQL operation failed')
      return result.stdout
    },
  }
}

export function prepareLocalScript() {
  try {
    const local = openLocalEnvironment()
    if (process.argv[2] === '--check-local') {
      console.log('Local Docker, API, database and Mailpit verified. No fixture or permission changes executed.')
      process.exit(0)
    }
    return local
  } catch {
    console.error('Local safety checks refused the operation. Check Docker context, loopback URLs, proxy and PostgreSQL overrides. No credentials printed.')
    process.exit(1)
  }
}
