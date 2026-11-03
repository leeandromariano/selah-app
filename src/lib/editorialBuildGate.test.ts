import { describe, expect, it } from 'vitest'
import { editorialBuildEnabled } from './editorialBuildGate'
import { createBuildEnvironment } from './environment'
const ref = 'ssssssssssssssssssss'
const vars = { VITE_STAGING_SUPABASE_PROJECT_REF: ref, VITE_STAGING_SUPABASE_URL: 'https://' + ref + '.supabase.co', VITE_STAGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fiction', VITE_STAGING_SITE_ORIGIN: 'https://staging.example.invalid', VITE_STAGING_PREVIEW_ORIGIN: 'https://preview.staging.example.invalid' }
const env = { SELAH_STAGING_BUILD: 'LOCAL_STAGING_BUILD', SELAH_STAGING_PREVIEW_BUILD: 'LOCAL_STAGING_PREVIEW_BUILD', SELAH_EDITORIAL_PREVIEW_BUILD: 'REVIEWED_EDITORIAL_PREVIEW', SELAH_EDITORIAL_BACKEND_VALIDATED_REF: ref }
describe('editorial build gate', () => {
  it('is closed by default and never enables hosted builds from the local switch', () => {
    expect(editorialBuildEnabled('staging', 'build', vars, {})).toBe(false)
    expect(editorialBuildEnabled('staging', 'build', vars, { SELAH_EDITORIAL_LOCAL: '1' })).toBe(false)
    expect(editorialBuildEnabled('development', 'build', {}, { SELAH_EDITORIAL_LOCAL: '1' })).toBe(false)
    expect(editorialBuildEnabled('development', 'serve', {}, { SELAH_EDITORIAL_LOCAL: '1' })).toBe(true)
  })
  it('allows only an explicitly attested staging preview with a distinct validated origin', () => {
    expect(createBuildEnvironment('staging', vars, true, true).variables.VITE_STAGING_SITE_ORIGIN).toBe(vars.VITE_STAGING_PREVIEW_ORIGIN)
    expect(editorialBuildEnabled('staging', 'build', vars, env)).toBe(true)
  })
  it.each([
    [{ ...env, SELAH_EDITORIAL_PREVIEW_BUILD: '' }, vars, 'staging', 'build'],
    [{ ...env, SELAH_EDITORIAL_BACKEND_VALIDATED_REF: '' }, vars, 'staging', 'build'],
    [{ ...env, SELAH_EDITORIAL_BACKEND_VALIDATED_REF: 'other' }, vars, 'staging', 'build'],
    [{ ...env, SELAH_STAGING_BUILD: '' }, vars, 'staging', 'build'],
    [{ ...env, SELAH_STAGING_PREVIEW_BUILD: '' }, vars, 'staging', 'build'],
    [env, { ...vars, VITE_STAGING_PREVIEW_ORIGIN: vars.VITE_STAGING_SITE_ORIGIN }, 'staging', 'build'],
    [env, vars, 'production', 'build'],
    [env, vars, 'staging', 'serve'],
  ])('fails closed when required approval, target or build context is absent', (environment, variables, mode, command) => {
    expect(() => editorialBuildEnabled(mode, command, variables, environment)).toThrow()
  })
  it('still requires the existing exact HTTPS origin validation', () => {
    expect(() => createBuildEnvironment('staging', { ...vars, VITE_STAGING_PREVIEW_ORIGIN: 'http://bad.invalid' }, true, true)).toThrow()
  })
})
