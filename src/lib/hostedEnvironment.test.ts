import { describe, expect, it, vi } from 'vitest'
import { createEnvironmentClient, prepareClientConfiguration, prepareHostedEnvironment, validateHostedOrigin } from './environment'

const ref = 's'.repeat(20)
const variables = { VITE_STAGING_SUPABASE_URL: `https://${ref}.supabase.co`, VITE_STAGING_SUPABASE_PROJECT_REF: ref, VITE_STAGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fiction', VITE_STAGING_SITE_ORIGIN: 'https://staging.example.invalid' }
describe('preparação hospedada sem habilitação', () => {
  it('valida contrato público fictício e origem canônica', () => {
    const config = prepareHostedEnvironment('staging', variables)
    expect(config).toMatchObject({ name: 'STAGING', login: 'email', siteOrigin: variables.VITE_STAGING_SITE_ORIGIN })
    expect(() => validateHostedOrigin(config, variables.VITE_STAGING_SITE_ORIGIN)).not.toThrow()
    for (const origin of ['http://staging.example.invalid', 'https://other.example.invalid', 'http://localhost:5173']) expect(() => validateHostedOrigin(config, origin)).toThrow()
  })
  it.each(['', 'http://staging.example.invalid', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://example.invalid/path', 'https://user@example.invalid', 'https://example.invalid?x=1', 'https://example.invalid:444'])('recusa origem inválida %s', siteOrigin => {
    expect(() => prepareHostedEnvironment('staging', { ...variables, VITE_STAGING_SITE_ORIGIN: siteOrigin })).toThrow()
  })
  it('não aceita backend local, segredo, configuração incompleta ou origem repetida', () => {
    for (const value of [{ ...variables, VITE_STAGING_SUPABASE_URL: 'http://127.0.0.1:54321' }, { ...variables, VITE_STAGING_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_fiction' }, { ...variables, VITE_STAGING_SUPABASE_PROJECT_REF: '' }, { ...variables, VITE_PROD_SITE_ORIGIN: variables.VITE_STAGING_SITE_ORIGIN }]) expect(() => prepareHostedEnvironment('staging', value)).toThrow()
  })
  it('não habilita cliente ou build remoto apesar do contrato válido', () => {
    const factory = vi.fn()
    expect(() => createEnvironmentClient({ mode: 'staging', variables }, factory, variables.VITE_STAGING_SITE_ORIGIN)).toThrow()
    expect(factory).not.toHaveBeenCalled()
  })
  it('prepara os mesmos parâmetros usados pela fábrica sem criar cliente remoto', () => {
    const plan = prepareClientConfiguration({ mode: 'staging', variables }, variables.VITE_STAGING_SITE_ORIGIN)
    expect(plan).toMatchObject({ url: variables.VITE_STAGING_SUPABASE_URL, key: variables.VITE_STAGING_SUPABASE_PUBLISHABLE_KEY, login: 'email', redirectOrigin: variables.VITE_STAGING_SITE_ORIGIN, options: { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } } })
    const factory = vi.fn()
    expect(() => createEnvironmentClient({ mode: 'staging', variables }, factory, variables.VITE_STAGING_SITE_ORIGIN)).toThrow('desabilitado')
    expect(factory).not.toHaveBeenCalled()
  })
  it('não prepara cliente com origem errada nem endpoint local', () => {
    for (const [config, origin] of [[variables, 'https://other.example.invalid'], [{ ...variables, VITE_STAGING_SUPABASE_URL: 'http://127.0.0.1:54321' }, variables.VITE_STAGING_SITE_ORIGIN]] as const) {
      expect(() => prepareClientConfiguration({ mode: 'staging', variables: config }, origin)).toThrow()
    }
  })
})
