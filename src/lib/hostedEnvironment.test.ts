import { describe, expect, it, vi } from 'vitest'
import { createBuildEnvironment, createEnvironmentClient, prepareClientConfiguration, prepareHostedEnvironment, validateHostedOrigin } from './environment'

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
  it('exige autorização de build independente das variáveis públicas', () => {
    expect(() => createBuildEnvironment('staging', variables)).toThrow('autorização')
    expect(() => createBuildEnvironment('staging', { ...variables, VITE_ENABLE_REMOTE: 'true' })).toThrow('autorização')
    expect(createBuildEnvironment('staging', variables, true).variables).toMatchObject(variables)
  })
  it('mantém Bíblia hospedada desligada até a habilitação explícita', () => {
    expect(createBuildEnvironment('staging', variables, true).variables.VITE_STAGING_BIBLE_ENABLED).toBe('false')
    expect(createBuildEnvironment('staging', { ...variables, VITE_STAGING_BIBLE_ENABLED: 'true' }, true).variables.VITE_STAGING_BIBLE_ENABLED).toBe('true')
    expect(() => createBuildEnvironment('staging', { ...variables, VITE_STAGING_BIBLE_ENABLED: 'yes' }, true)).toThrow()
  })
  it('recusa origem diferente antes da criação do cliente', () => {
    const factory = vi.fn()
    expect(() => createEnvironmentClient({ mode: 'staging', variables }, factory, 'https://other.example.invalid')).toThrow()
    expect(factory).not.toHaveBeenCalled()
  })
  it('passa os parâmetros hospedados validados a uma fábrica simulada, sem rede', () => {
    const plan = prepareClientConfiguration({ mode: 'staging', variables }, variables.VITE_STAGING_SITE_ORIGIN)
    expect(plan).toMatchObject({ url: variables.VITE_STAGING_SUPABASE_URL, key: variables.VITE_STAGING_SUPABASE_PUBLISHABLE_KEY, login: 'email', redirectOrigin: variables.VITE_STAGING_SITE_ORIGIN, options: { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } } })
    const factory = vi.fn()
    createEnvironmentClient({ mode: 'staging', variables }, factory, variables.VITE_STAGING_SITE_ORIGIN)
    expect(factory).toHaveBeenCalledExactlyOnceWith(plan.url, plan.key, plan.options)
  })
  it('não injeta outros ambientes e nunca habilita PROD', () => {
    const build = createBuildEnvironment('staging', { ...variables, VITE_UNUSED: 'not-for-bundle', VITE_DEV_SUPABASE_URL: 'http://127.0.0.1:54321' }, true)
    expect(JSON.stringify(build)).not.toContain('not-for-bundle')
    expect(JSON.stringify(build)).not.toContain('127.0.0.1')
    expect(() => createBuildEnvironment('production', {}, true)).toThrow('desabilitado')
    const factory = vi.fn()
    const prod = { VITE_PROD_SUPABASE_URL: variables.VITE_STAGING_SUPABASE_URL, VITE_PROD_SUPABASE_PROJECT_REF: ref, VITE_PROD_SUPABASE_PUBLISHABLE_KEY: variables.VITE_STAGING_SUPABASE_PUBLISHABLE_KEY, VITE_PROD_SITE_ORIGIN: 'https://prod.example.invalid' }
    expect(() => createEnvironmentClient({ mode: 'production', variables: prod }, factory, prod.VITE_PROD_SITE_ORIGIN)).toThrow('desabilitado')
    expect(factory).not.toHaveBeenCalled()
  })
  it('não prepara cliente com origem errada nem endpoint local', () => {
    for (const [config, origin] of [[variables, 'https://other.example.invalid'], [{ ...variables, VITE_STAGING_SUPABASE_URL: 'http://127.0.0.1:54321' }, variables.VITE_STAGING_SITE_ORIGIN]] as const) {
      expect(() => prepareClientConfiguration({ mode: 'staging', variables: config }, origin)).toThrow()
    }
  })
})

describe('Preview origin', () => {
 const preview = 'https://10ed050b.selah-staging.pages.dev'
 it('allows only the exact configured origin for the selected build', () => {
  const main = createBuildEnvironment('staging', variables, true)
  const b = createBuildEnvironment('staging', {...variables, VITE_STAGING_PREVIEW_ORIGIN:preview}, true, true)
  const factory = vi.fn()
  expect(() => createEnvironmentClient(main, factory, variables.VITE_STAGING_SITE_ORIGIN)).not.toThrow()
  expect(() => createEnvironmentClient(b, factory, preview)).not.toThrow()
  for (const o of ['http://10ed050b.selah-staging.pages.dev','https://10ed050b.selah-staging.pages.dev.evil.invalid','https://other.selah-staging.pages.dev','https://other.pages.dev', variables.VITE_STAGING_SITE_ORIGIN]) expect(() => createEnvironmentClient(b, factory, o)).toThrow()
  expect(() => createEnvironmentClient(main, factory, preview)).toThrow()
  expect(factory).toHaveBeenCalledTimes(2)
 })
 it('fails closed without explicit approval or valid origin', () => {
  expect(() => createBuildEnvironment('staging', {...variables,VITE_STAGING_PREVIEW_ORIGIN:preview}, true)).toThrow()
  expect(() => createBuildEnvironment('staging', variables, true, true)).toThrow()
  expect(() => createBuildEnvironment('staging', {...variables,VITE_STAGING_SITE_ORIGIN:'',VITE_STAGING_PREVIEW_ORIGIN:preview}, true, true)).toThrow()
  for (const o of ['', 'http://evil.invalid','https://evil.invalid/path']) expect(() => createBuildEnvironment('staging', {...variables,VITE_STAGING_PREVIEW_ORIGIN:o}, true, true)).toThrow()
 })
})
