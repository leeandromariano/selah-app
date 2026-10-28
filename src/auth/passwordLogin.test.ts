import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { emailPasswordLogin, normalizeLoginIdentifier, passwordLogin } from './passwordLogin'

describe('login único e sessão oficial', () => {
  it.each(['pessoa_01', '@pessoa_01', ' PESSOA_01 ', ' @PESSOA_01 '])('normaliza username %s sem resolver e-mail no cliente', async input => {
    await passwordLogin(supabase, input, ' senha fictícia ')
    expect(supabase.functions.invoke).toHaveBeenCalledExactlyOnceWith('password-login', { body: { identifier: 'pessoa_01', password: ' senha fictícia ' } })
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
    expect(supabase.auth.setSession).toHaveBeenCalledExactlyOnceWith({ access_token: 'fiction-access', refresh_token: 'fiction-refresh' })
  })
  it('preserva entrada por e-mail legado e nunca consulta profiles ou RPC de resolução', async () => {
    await passwordLogin(supabase, ' LEGADO@EXAMPLE.INVALID ', 'fiction-only')
    expect(supabase.functions.invoke).toHaveBeenCalledWith('password-login', { body: { identifier: 'legado@example.invalid', password: 'fiction-only' } })
    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
  it.each(['', '@@pessoa', '+5511999990000', 'ab', 'a'.repeat(25), 'a.b'])('recusa identificador inválido %s', input => {
    expect(() => normalizeLoginIdentifier(input)).toThrow()
  })
  it.each([[401, 'invalid_credentials'], [429, 'over_request_rate_limit'], [503, 'login_unavailable']])('sanitiza erro HTTP %s sem expor detalhes', async (status, code) => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ error: { context: { status }, message: 'private other@example.invalid' }, data: null } as never)
    await expect(passwordLogin(supabase, 'pessoa_01', 'fiction-only')).rejects.toEqual({ code })
    expect(supabase.auth.setSession).not.toHaveBeenCalled()
  })
  it('recusa resposta sem tokens e nunca converte resposta em credenciais de e-mail', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: { email: 'private@example.invalid' }, error: null } as never)
    await expect(passwordLogin(supabase, 'pessoa_01', 'fiction-only')).rejects.toEqual({ code: 'login_unavailable' })
    expect(supabase.auth.setSession).not.toHaveBeenCalled()
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })
  it('falha de instalação da sessão não declara sucesso nem expõe diagnóstico Auth', async () => {
    vi.mocked(supabase.auth.setSession).mockResolvedValueOnce({ data: { session: null }, error: { message: 'sensitive' } } as never)
    await expect(passwordLogin(supabase, 'pessoa_01', 'fiction-only')).rejects.toEqual({ code: 'login_unavailable' })
  })
})

describe('login hospedado por e-mail com fronteira simulada', () => {
  it('normaliza e usa Auth oficial sem consultar a função local', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({ data: { session: { user: { id: 'fiction' } } }, error: null } as never)
    await emailPasswordLogin(supabase, ' LEITOR@EXAMPLE.INVALID ', 'fiction-only')
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledExactlyOnceWith({ email: 'leitor@example.invalid', password: 'fiction-only' })
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })
  it('recusa username e não revela diagnósticos privados', async () => {
    await expect(emailPasswordLogin(supabase, 'username', 'fiction')).rejects.toEqual({ code: 'invalid_identifier' })
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({ data: { session: null }, error: { code: 'unexpected', message: 'private' } } as never)
    await expect(emailPasswordLogin(supabase, 'leitor@example.invalid', 'fiction')).rejects.toEqual({ code: 'login_unavailable' })
  })
  it('não revela se o e-mail existe mas ainda não foi confirmado', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({ data: { session: null }, error: { code: 'email_not_confirmed' } } as never)
    await expect(emailPasswordLogin(supabase, 'leitor@example.invalid', 'fiction')).rejects.toEqual({ code: 'invalid_credentials' })
  })
})
