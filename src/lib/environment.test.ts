import { describe, expect, it, vi } from 'vitest'
import { createBuildEnvironment, createEnvironmentClient, prepareHostedEnvironment, requireEnabledEnvironment, resolveEnvironment, validateHostedOrigin, validatePublicKey } from './environment'

const dev = { VITE_DEV_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_DEV_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fiction' }
const legacy = { VITE_SUPABASE_URL: dev.VITE_DEV_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY: dev.VITE_DEV_SUPABASE_PUBLISHABLE_KEY }
const ref = 's'.repeat(20)
const staging = { VITE_STAGING_SUPABASE_URL: `https://${ref}.supabase.co`, VITE_STAGING_SUPABASE_PROJECT_REF: ref, VITE_STAGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_staging_fiction' }
const jwt = (role: string, project?: string) => `fiction.${btoa(JSON.stringify({ role, ref: project })).replaceAll('=', '')}.fiction`

describe('contrato DEV/STAGING/PROD sem serviços externos', () => {
  it('seleciona DEV pelo modo explícito e preserva configuração do script local', () => {
    expect(resolveEnvironment('development', dev)).toMatchObject({ name: 'DEV', enabled: true, url: dev.VITE_DEV_SUPABASE_URL })
    expect(resolveEnvironment('development', legacy)).toEqual(resolveEnvironment('development', dev))
    expect(resolveEnvironment('development', { ...dev, ...legacy })).toEqual(resolveEnvironment('development', dev))
  })
  it.each(['', 'test', 'prod', 'DEV', 'constructor', '__proto__'])('recusa modo desconhecido %s sem fallback', mode => {
    expect(() => resolveEnvironment(mode, dev)).toThrow('Modo desconhecido')
  })
  it.each(['STAGING', 'PROD', '', 'dev'])('recusa declaração conflitante %s', name => {
    expect(() => resolveEnvironment('development', { ...dev, VITE_APP_ENV: name })).toThrow('não corresponde')
  })
  it('recusa URL/chave ausentes e conflito entre legado e namespace DEV', () => {
    for (const variables of [{}, { VITE_DEV_SUPABASE_URL: dev.VITE_DEV_SUPABASE_URL }, { ...dev, VITE_SUPABASE_URL: 'https://fiction.invalid' }, { ...dev, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_other_fiction' }]) expect(() => resolveEnvironment('development', variables)).toThrow()
  })
  it.each(['http://localhost:54321', 'http://[::1]:54321', 'http://127.0.0.1:54322', 'https://fiction.invalid', 'http://127.0.0.1:54321/', 'http://127.0.0.1:54321/path', 'http://user:fiction@127.0.0.1:54321', 'http://127.0.0.1:54321?host=fiction.invalid'])('DEV recusa URL inesperada %s', url => {
    expect(() => resolveEnvironment('development', { ...dev, VITE_DEV_SUPABASE_URL: url })).toThrow('DEV exige exatamente')
  })
  it.each(['', 'sb_secret_fiction', 'sb_publishable_', 'sb_publishable_fiction\n', 'sb_publishable_fiction key', jwt('service_role'), jwt('authenticated'), 'invalid', 'x.e30.x'])('recusa chave inadequada %s', key => {
    expect(() => validatePublicKey(key)).toThrow()
  })
  it('aceita somente formato público/anon, sem alegar autenticidade criptográfica', () => {
    expect(() => validatePublicKey(jwt('anon'))).not.toThrow()
    expect(() => validatePublicKey(dev.VITE_DEV_SUPABASE_PUBLISHABLE_KEY)).not.toThrow()
  })
  it.each(['VITE_SERVICE_ROLE', 'VITE_SUPABASE_SECRET_KEY', 'VITE_ADMIN_KEY', 'VITE_ACCESS_TOKEN', 'VITE_DB_PASSWORD'])('recusa variável pública privilegiada %s', key => {
    expect(() => resolveEnvironment('development', { ...dev, [key]: 'fiction' })).toThrow('privilegiada')
  })
  it.each(['staging', 'production'])('%s permanece desabilitado sem configuração, sem fallback para DEV', mode => {
    expect(resolveEnvironment(mode, {})).toMatchObject({ enabled: false })
    expect(() => requireEnabledEnvironment(mode, {})).toThrow('desabilitado')
    expect(() => resolveEnvironment(mode, legacy)).toThrow('exclusivas de DEV')
    expect(() => createBuildEnvironment(mode, {})).toThrow(mode === 'staging' ? 'autorização' : 'desabilitado')
  })
  it('guarda genérica de STAGING permanece bloqueada mesmo com flags públicas', () => {
    const variables = { ...staging, VITE_ENABLE_REMOTE: 'true', VITE_PROD_ENABLED: 'true' }
    expect(resolveEnvironment('staging', variables)).toEqual({ name: 'STAGING', enabled: false, reason: expect.stringContaining('desabilitado') })
    expect(() => requireEnabledEnvironment('staging', variables)).toThrow('desabilitado')
  })
  it('PROD tem namespace independente e continua desabilitado', () => {
    const variables = { VITE_PROD_SUPABASE_URL: staging.VITE_STAGING_SUPABASE_URL, VITE_PROD_SUPABASE_PROJECT_REF: ref, VITE_PROD_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_prod_fiction' }
    expect(resolveEnvironment('production', variables)).toMatchObject({ name: 'PROD', enabled: false })
    expect(() => requireEnabledEnvironment('production', variables)).toThrow('desabilitado')
  })
  it('valida completude, HTTPS, referência e ausência de caminhos no contrato futuro', () => {
    for (const variables of [
      { VITE_STAGING_SUPABASE_URL: staging.VITE_STAGING_SUPABASE_URL },
      { ...staging, VITE_STAGING_SUPABASE_URL: 'http://127.0.0.1:54321' },
      { ...staging, VITE_STAGING_SUPABASE_URL: staging.VITE_STAGING_SUPABASE_URL + '/' },
      { ...staging, VITE_STAGING_SUPABASE_PROJECT_REF: 'another-project' },
      { ...staging, VITE_STAGING_SUPABASE_PUBLISHABLE_KEY: jwt('anon', 'p'.repeat(20)) },
      { ...staging, VITE_STAGING_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_fiction' },
    ]) expect(() => resolveEnvironment('staging', variables)).toThrow()
    expect(resolveEnvironment('staging', { ...staging, VITE_STAGING_SUPABASE_PUBLISHABLE_KEY: jwt('anon', ref) })).toMatchObject({ enabled: false })
  })
  it('recusa reutilização do projeto ou chave entre STAGING e PROD', () => {
    for (const variables of [
      { ...staging, VITE_PROD_SUPABASE_PROJECT_REF: ref },
      { ...staging, VITE_PROD_SUPABASE_URL: staging.VITE_STAGING_SUPABASE_URL },
      { ...staging, VITE_PROD_SUPABASE_PUBLISHABLE_KEY: staging.VITE_STAGING_SUPABASE_PUBLISHABLE_KEY },
    ]) expect(() => resolveEnvironment('staging', variables)).toThrow('distintos')
  })
  it('aceita apenas as duas origens HTTPS declaradas no build hospedado e mantém a prévia isolada', () => {
    const primary = 'https://selah-staging.pages.dev'
    const additional = 'https://appcoram.com.br'
    const variables = { ...staging, VITE_STAGING_SITE_ORIGIN: primary, VITE_STAGING_ADDITIONAL_SITE_ORIGIN: additional }
    const config = prepareHostedEnvironment('staging', variables)
    expect(() => validateHostedOrigin(config, primary)).not.toThrow()
    expect(() => validateHostedOrigin(config, additional)).not.toThrow()
    expect(() => validateHostedOrigin(config, 'https://www.appcoram.com.br')).toThrow()
    const build = createBuildEnvironment('staging', variables, true)
    expect(build.variables.VITE_STAGING_ADDITIONAL_SITE_ORIGIN).toBe(additional)
    const preview = createBuildEnvironment('staging', { ...variables, VITE_STAGING_PREVIEW_ORIGIN: 'https://preview.pages.dev' }, true, true)
    expect(preview.variables.VITE_STAGING_SITE_ORIGIN).toBe('https://preview.pages.dev')
    expect(preview.variables.VITE_STAGING_ADDITIONAL_SITE_ORIGIN).toBeUndefined()
    for (const invalid of [primary, 'http://appcoram.com.br', 'https://appcoram.com.br/', 'https://appcoram.com.br:443', 'https://localhost']) {
      expect(() => prepareHostedEnvironment('staging', { ...variables, VITE_STAGING_ADDITIONAL_SITE_ORIGIN: invalid })).toThrow()
    }
  })
  it('só inclui configuração DEV selecionada no artefato; descarta outras variáveis', () => {
    const build = createBuildEnvironment('development', { ...dev, ...staging, VITE_UNUSED: 'fiction' })
    expect(build).toEqual({ mode: 'development', variables: { ...dev, VITE_APP_ENV: 'DEV' } })
    expect(JSON.stringify(build)).not.toContain('staging_fiction')
  })
  it('valida antes de criar cliente e preserva opções de sessão local', () => {
    const factory = vi.fn().mockReturnValue({ fictionalClient: true })
    expect(createEnvironmentClient({ mode: 'development', variables: legacy }, factory, 'http://127.0.0.1:5173')).toEqual({ fictionalClient: true })
    expect(factory).toHaveBeenCalledExactlyOnceWith(dev.VITE_DEV_SUPABASE_URL, dev.VITE_DEV_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } })
    factory.mockClear()
    for (const build of [{ mode: 'development', variables: {} }, { mode: 'staging', variables: staging }, { mode: 'production', variables: {} }]) expect(() => createEnvironmentClient(build, factory, 'http://127.0.0.1:5173')).toThrow()
    expect(factory).not.toHaveBeenCalled()
  })
  it('recusa artefato DEV servido por origem remota, inválida ou porta inesperada', () => {
    const factory = vi.fn()
    for (const origin of ['https://fiction.invalid', 'http://127.0.0.1:9999', 'https://localhost:5173', 'null', 'http://localhost:5173/path', 'http://127.0.0.1.fiction.invalid:5173']) expect(() => createEnvironmentClient({ mode: 'development', variables: dev }, factory, origin)).toThrow()
    expect(factory).not.toHaveBeenCalled()
    for (const origin of ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://localhost:4173']) expect(() => createEnvironmentClient({ mode: 'development', variables: dev }, factory, origin)).not.toThrow()
    expect(factory).toHaveBeenCalledTimes(4)
  })
})
