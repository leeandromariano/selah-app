import { describe, expect, it } from 'vitest'
import { validateLocalAuthConfig } from './localAuthConfig'

describe('restrição ao Supabase local', () => {
  it('permite URL local com chave pública e recusa destinos externos, portas e credenciais na URL', () => {
    expect(() => validateLocalAuthConfig('http://127.0.0.1:54321', 'sb_publishable_fiction')).not.toThrow()
    for (const url of ['https://example.supabase.co', 'http://127.0.0.1:54322', 'http://127.0.0.1.example.invalid:54321', 'http://user:password@127.0.0.1:54321', 'http://127.0.0.1:54321/path']) {
      expect(() => validateLocalAuthConfig(url, 'sb_publishable_fiction')).toThrow()
    }
  })
  it('aceita JWT anon fictício e rejeita chaves secretas, JWT service_role e valores malformados', () => {
    const jwt = (role: string) => `fiction.${btoa(JSON.stringify({ role }))}.fiction`
    expect(() => validateLocalAuthConfig('http://localhost:54321', jwt('anon'))).not.toThrow()
    for (const key of ['sb_secret_fiction', jwt('service_role'), 'invalid', '']) expect(() => validateLocalAuthConfig('http://localhost:54321', key)).toThrow()
  })
})
