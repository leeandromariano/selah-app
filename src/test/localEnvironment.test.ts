/// <reference types="node" />
import { describe, expect, it, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { localFetch, localUrl, openLocalEnvironment, validateLocalEnvironment } from '../../scripts/local-environment.mjs'

const endpoint = 'npipe:////./pipe/dockerDesktopLinuxEngine'
const config = { API_URL: 'http://127.0.0.1:54321', DB_URL: 'postgresql://postgres:fiction@127.0.0.1:54322/postgres', INBUCKET_URL: 'http://127.0.0.1:54324', PUBLISHABLE_KEY: 'sb_publishable_fiction' }
function fixture(overrides = {}, port = true) {
  return vi.fn((command: string, args: string[]) => {
    if (command !== 'docker') return { status: 0, stdout: JSON.stringify({ ...config, ...overrides }) }
    if (args[0] === 'context') return { status: 0, stdout: JSON.stringify(endpoint) }
    if (args.includes('port')) return { status: 0, stdout: port ? `127.0.0.1:${args.includes('5432/tcp') ? '54322' : args.includes('8000/tcp') ? '54321' : '54324'}\n` : '127.0.0.1:1' }
    return { status: 0, stdout: 'ROLLBACK\n' }
  })
}

describe('fronteiras dos scripts locais', () => {
  it('aceita apenas serviços e portas explícitos e normaliza localhost', () => {
    expect(localUrl('http://localhost:54321/rest/v1/profiles', 'api').hostname).toBe('127.0.0.1')
    expect(localUrl('http://[::1]:54324/api/v1/messages', 'mail').hostname).toBe('[::1]')
    for (const url of ['https://fiction.supabase.co', 'http://127.0.0.1.fiction.invalid:54321', 'http://fiction.invalid:54321', 'http://127.0.0.1:54324', 'http://user:fiction@127.0.0.1:54321']) expect(() => localUrl(url, 'api')).toThrow()
    expect(() => localUrl(config.DB_URL + '?host=fiction.invalid', 'database')).toThrow()
    expect(() => localUrl('http://127.0.0.1:54321/path', 'api', { root: true })).toThrow()
  })
  it.each([
    { SUPABASE_URL: 'https://fiction.supabase.co' }, { VITE_SUPABASE_URL: 'https://fiction.invalid' },
    { DATABASE_URL: 'postgresql://fiction.invalid:54322/postgres' }, { PGHOST: 'fiction.invalid' },
    { PGHOSTADDR: '192.0.2.1' }, { PGPORT: '9999' }, { PGDATABASE: 'other' },
    { PGSERVICE: 'fiction' }, { PGSERVICEFILE: 'fiction' }, { HTTPS_PROXY: 'http://fiction.invalid' },
  ])('recusa configuração conflitante antes de qualquer comando (%j)', environment => {
    const run = fixture()
    expect(() => openLocalEnvironment({ run, environment })).toThrow()
    expect(run).not.toHaveBeenCalled()
  })
  it.each([
    { API_URL: 'https://fiction.supabase.co' }, { DB_URL: 'postgresql://fiction.invalid:54322/postgres' },
    { STUDIO_URL: 'https://fiction.invalid' }, { PUBLISHABLE_KEY: 'sb_secret_fiction' },
    { PUBLISHABLE_KEY: `x.${Buffer.from('{"role":"service_role"}').toString('base64url')}.x` },
  ])('recusa status inseguro antes de consultar portas ou executar SQL (%j)', overrides => {
    const run = fixture(overrides)
    expect(() => openLocalEnvironment({ run, environment: {} })).toThrow()
    expect(run).toHaveBeenCalledTimes(2)
  })
  it('recusa mapeamento incorreto, CLI indisponível e JSON inválido', () => {
    expect(() => openLocalEnvironment({ run: fixture({}, false), environment: {} })).toThrow('mapping')
    for (const response of [{ status: 1, stdout: '' }, { status: 0, stdout: 'invalid' }]) {
      const run = fixture().mockImplementationOnce(() => ({ status: 0, stdout: JSON.stringify(endpoint) })).mockImplementationOnce(() => response)
      expect(() => openLocalEnvironment({ run, environment: {} })).toThrow()
      expect(run).toHaveBeenCalledTimes(2)
    }
  })
  it('fixa ambiente CLI e socket PostgreSQL mesmo diante de opções fornecidas ao Docker', () => {
    const run = fixture()
    const local = openLocalEnvironment({ run, environment: {} })
    expect(local.psql('begin read only; select 1; rollback;')).toBe('ROLLBACK\n')
    expect(run.mock.calls.at(-1)?.[1]).toEqual(['--host', endpoint, 'exec', '-i', 'supabase_db_devocionais-app', 'psql', '-X', '-h', '/var/run/postgresql', '-p', '5432', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'])
    expect(run).toHaveBeenCalledWith(process.execPath, expect.arrayContaining(['status', '-o', 'json']), expect.objectContaining({ env: { DOCKER_HOST: endpoint } }))
  })
  it('propaga falha do psql sem imprimir SQL ou saída potencialmente sensível', () => {
    const run = fixture()
    const local = openLocalEnvironment({ run, environment: {} })
    run.mockReturnValueOnce({ status: 1, stdout: 'sensitive diagnostic must remain private' })
    expect(() => local.psql('select 1')).toThrow('Local PostgreSQL operation failed')
  })
  it('revalida variáveis antes de SQL e HTTP para impedir mudança após preflight', async () => {
    const environment: Record<string, string> = {}
    const run = fixture()
    const transport = vi.fn()
    const local = openLocalEnvironment({ run, environment, transport })
    environment.PGHOST = 'fiction.invalid'
    expect(() => local.psql('select 1')).toThrow()
    await expect(local.fetch(config.API_URL)).rejects.toThrow()
    expect(run).toHaveBeenCalledTimes(5)
    expect(transport).not.toHaveBeenCalled()
  })
  it('não segue redirect remoto e preserva POST/headers/body do SDK na fronteira', async () => {
    const transport = vi.fn(async (request: Request) => {
      expect(request.url).toBe('http://127.0.0.1:54321/auth/v1/signup')
      expect(request.redirect).toBe('manual')
      expect(request.method).toBe('POST')
      expect(request.headers.get('apikey')).toBe('fiction')
      expect(await request.text()).toBe('{"fiction":true}')
      return new Response(null, { status: 302, headers: { location: 'https://fiction.invalid' } })
    })
    const request = localFetch(transport as typeof fetch, {})
    expect((await request('http://localhost:54321/auth/v1/signup', { method: 'POST', headers: { apikey: 'fiction' }, body: '{"fiction":true}', redirect: 'follow' })).status).toBe(302)
    expect(transport).toHaveBeenCalledTimes(1)
    await expect(request('https://fiction.invalid')).rejects.toThrow()
    await expect(request('http://127.0.0.1:5173')).rejects.toThrow()
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it('cliente Supabase usa a mesma fronteira validada', async () => {
    const transport = vi.fn(async (request: Request) => {
      expect(request.url).toBe('http://127.0.0.1:54321/rest/v1/devotionals?select=id')
      expect(request.redirect).toBe('manual')
      return new Response('[]', { headers: { 'Content-Type': 'application/json' } })
    })
    const local = openLocalEnvironment({ run: fixture(), environment: {}, transport: transport as typeof fetch })
    expect((await local.client().from('devotionals').select('id')).error).toBeNull()
    expect(transport).toHaveBeenCalledTimes(1)
    validateLocalEnvironment({ SUPABASE_URL: config.API_URL, DATABASE_URL: config.DB_URL })
  })
  for (const script of ['configure-local-auth', 'local-auth-smoke', 'local-profile-smoke', 'local-library-smoke', 'local-admin-smoke', 'local-privacy-smoke', 'local-username-smoke', 'provision-local-admin', 'run-local-authorization']) {
    it(`${script}: entrypoint recusa Docker remoto, URL remota e contexto malicioso`, () => {
      for (const unsafe of [{ DOCKER_HOST: 'ssh://fiction.invalid' }, { SUPABASE_URL: 'https://fiction.invalid' }, { DOCKER_CONTEXT: '--host=tcp://fiction.invalid' }]) {
        const env = { ...process.env }
        for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'DOCKER_HOST', 'DOCKER_CONTEXT']) delete env[key]
        const modes = script === 'provision-local-admin'
          ? [['--check-local'], ['grant', '10000000-0000-4000-8000-000000000001'], ['revoke', '10000000-0000-4000-8000-000000000001']]
          : script === 'local-privacy-smoke' ? [['--check-local'], [], ['--sql'], ['--inventory']] : script === 'local-username-smoke' ? [['--check-local'], [], ['--sql']] : [['--check-local'], []]
        for (const args of modes) {
          const result = spawnSync(process.execPath, [`scripts/${script}.mjs`, ...args], { env: { ...env, ...unsafe }, encoding: 'utf8', timeout: 10000 })
          expect(result.status).toBe(1)
          expect(result.stderr).toMatch(/refused/i)
          expect(result.stdout).toBe('')
        }
      }
    }, 15000)
  }
})
