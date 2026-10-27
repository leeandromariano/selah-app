import { describe, expect, it, vi } from 'vitest'
import { createPasswordLogin, invalidLogin, limitedLogin, localLoginEnvironment, officialPasswordSession } from '../../supabase/functions/_shared/password-login'

function fixture() {
  const deps = { budget: vi.fn().mockResolvedValue(true), resolve: vi.fn().mockResolvedValue('private@example.invalid'), authenticate: vi.fn().mockResolvedValue({ access_token: 'fiction-access', refresh_token: 'fiction-refresh' }), dummyEmail: () => 'dummy@example.invalid', now: () => 100, pause: vi.fn().mockResolvedValue(undefined), jitter: () => 50 }
  const handle = createPasswordLogin(deps)
  const request = (identifier: unknown, password: unknown = 'fiction-only', extra: RequestInit = {}) => handle(new Request('http://127.0.0.1:54321/functions/v1/password-login', { method: 'POST', body: JSON.stringify({ identifier, password }), ...extra }))
  return { deps, handle, request }
}
describe('servidor de senha: integrações simuladas na fronteira', () => {
  it.each([0, undefined, 429, 503])('erro de transporte ou serviço Auth %s retorna indisponibilidade, sem culpar a senha', async status => {
    const { deps, request } = fixture()
    deps.authenticate.mockImplementation(async () => officialPasswordSession({ data: { session: null }, error: { status, message: 'private@example.invalid fiction-password' } } as never))
    const response = await request('pessoa_01')
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ code: 'login_unavailable', message: 'Não foi possível entrar. Tente novamente mais tarde.' })
  })
  it.each([400, 401, 403])('erro de credencial Auth %s permanece 401 genérico', async status => {
    const { deps, request } = fixture()
    deps.authenticate.mockImplementation(async () => officialPasswordSession({ data: { session: null }, error: { status } }))
    const response = await request('pessoa_01')
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual(invalidLogin)
  })
  it('resposta inesperada do Auth sem sessão não é tratada como senha incorreta', async () => {
    const { deps, request } = fixture()
    deps.authenticate.mockImplementation(async () => officialPasswordSession({ data: { session: null }, error: null }))
    const response = await request('pessoa_01')
    expect(response.status).toBe(503)
  })
  it.each(['pessoa_01', '@PESSOA_01', ' @pessoa_01 '])('resolve %s somente no servidor e retorna apenas tokens', async identifier => {
    const { deps, request } = fixture()
    const r = await request(identifier)
    expect(r.status).toBe(200)
    expect(deps.resolve).toHaveBeenCalledExactlyOnceWith('pessoa_01')
    expect(deps.authenticate).toHaveBeenCalledExactlyOnceWith('private@example.invalid', 'fiction-only')
    expect(await r.json()).toEqual({ access_token: 'fiction-access', refresh_token: 'fiction-refresh' })
    expect(r.headers.get('cache-control')).toBe('no-store')
  })
  it('e-mail usa o verificador oficial sem resolução de username', async () => {
    const { deps, request } = fixture()
    await request(' LEGADO@EXAMPLE.INVALID ')
    expect(deps.resolve).not.toHaveBeenCalled()
    expect(deps.authenticate).toHaveBeenCalledWith('legado@example.invalid', 'fiction-only')
  })
  it.each(['missing', 'password', 'unconfirmed'])('%s recebe mesmo status, formato e piso de tempo', async mode => {
    const { deps, request } = fixture()
    if (mode === 'missing') deps.resolve.mockResolvedValue(null)
    else deps.authenticate.mockResolvedValue(null)
    const r = await request('pessoa_01')
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual(invalidLogin)
    expect(deps.authenticate).toHaveBeenCalledOnce()
    expect(deps.pause).toHaveBeenCalledWith(750)
  })
  it('limite persistente rejeita antes de consultar a conta ou validar senha, ignorando IP forjado', async () => {
    const { deps, request } = fixture()
    deps.budget.mockResolvedValue(false)
    const r = await request('@PESSOA_01', 'fiction-only', { headers: { 'x-forwarded-for': '192.0.2.8' } })
    expect(r.status).toBe(429)
    expect(r.headers.get('retry-after')).toBe('600')
    expect(await r.json()).toEqual(limitedLogin)
    expect(deps.budget).toHaveBeenCalledWith('username:pessoa_01')
    expect(deps.resolve).not.toHaveBeenCalled()
    expect(deps.authenticate).not.toHaveBeenCalled()
  })
  it('banco indisponível falha fechado, sem expor erro ou chamar Auth', async () => {
    const { deps, request } = fixture()
    deps.budget.mockRejectedValue(new Error('private@example.invalid'))
    const r = await request('pessoa_01')
    expect(r.status).toBe(503)
    expect(await r.text()).not.toContain('private@')
    expect(deps.authenticate).not.toHaveBeenCalled()
  })
  it('falha interna não registra credenciais nem inclui diagnóstico na resposta', async () => {
    const { deps, request } = fixture()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      deps.resolve.mockRejectedValue(new Error('private@example.invalid fiction-password fiction-token'))
      const response = await request('pessoa_01')
      expect(response.status).toBe(503)
      expect(await response.text()).not.toMatch(/private@|fiction-password|fiction-token/)
      expect(log).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
    } finally { log.mockRestore(); error.mockRestore() }
  })
  it('CORS permite apenas origens DEV e não é tratado como prova de usuário', async () => {
    const { request, deps } = fixture()
    const rejected = await request('pessoa_01', 'fiction-only', { headers: { origin: 'https://fiction.invalid' } })
    expect(rejected.status).toBe(403)
    expect(deps.budget).not.toHaveBeenCalled()
    const accepted = await request('pessoa_01', 'fiction-only', { headers: { origin: 'http://127.0.0.1:5173' } })
    expect(accepted.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173')
  })
  it.each(['', '+5511999990000', true])('entrada malformada não permite autenticação (%s)', async identifier => {
    const { deps, request } = fixture()
    const r = await request(identifier)
    expect(r.status).toBe(401)
    expect(deps.authenticate).not.toHaveBeenCalled()
  })
  it('limita bytes reais do corpo sem confiar em Content-Length', async () => {
    const { request, deps } = fixture()
    const r = await request('pessoa_01', 'a'.repeat(5000), { headers: { 'content-length': '1' } })
    expect(r.status).toBe(401)
    expect(deps.authenticate).not.toHaveBeenCalled()
  })
})

describe('destinos internos exclusivos do runtime local', () => {
  const api = 'http://kong:8000'
  const db = 'postgresql://postgres:fiction@db:5432/postgres'
  it('aceita somente os serviços Docker locais esperados', () => {
    expect(localLoginEnvironment(api, db).api).toBe(api)
  })
  it.each(['https://fiction.supabase.co', 'http://evil.invalid:8000', 'http://kong:8000@evil.invalid', 'http://kong:8000/path', 'http://kong:8000/?target=evil'])('recusa Auth %s', value => {
    expect(() => localLoginEnvironment(value, db)).toThrow()
  })
  it.each(['postgresql://postgres:fiction@evil.invalid:5432/postgres', 'postgresql://postgres:fiction@db:5432/other', db + '?host=evil.invalid', 'postgresql://service_role:fiction@db:5432/postgres'])('recusa PostgreSQL %s', value => {
    expect(() => localLoginEnvironment(api, value)).toThrow()
  })
})
