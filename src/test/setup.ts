import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { consistencyFixture } from './consistencyBoundary'
import { readFileSync } from 'node:fs'
import type { AppearanceStore } from '../appearance/store'

const appearanceBootstrap = readFileSync('public/appearance.js', 'utf8')

vi.mock('../lib/supabase', () => ({ loginMethod: 'local', environmentName: 'DEV', supabase: {
  auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn(), signInWithOAuth: vi.fn(), setSession: vi.fn(), signOut: vi.fn(), resetPasswordForEmail: vi.fn(), updateUser: vi.fn() },
  functions: { invoke: vi.fn() },
  rpc: vi.fn(),
  from: vi.fn(),
} }))

beforeEach(() => {
  ;(window.selahAppearance as AppearanceStore | undefined)?.dispose()
  Reflect.deleteProperty(window, 'selahAppearance')
  localStorage.removeItem('selah.appearance.v1')
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  new Function(appearanceBootstrap)()
  const emptyQuery = { select: vi.fn(), eq: vi.fn(), lte: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValue({ data: [], error: null }) }
  for (const method of ['select', 'eq', 'lte', 'order'] as const) emptyQuery[method].mockReturnValue(emptyQuery)
  vi.mocked(supabase.from).mockReset().mockReturnValue(emptyQuery as never)
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null })
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } } as never)
  for (const method of ['signUp', 'signInWithPassword', 'signInWithOAuth', 'signOut', 'resetPasswordForEmail', 'updateUser'] as const) vi.mocked(supabase.auth[method]).mockReset().mockResolvedValue({ data: {}, error: null } as never)
  vi.mocked(supabase.functions.invoke).mockReset().mockResolvedValue({ data: { access_token: 'fiction-access', refresh_token: 'fiction-refresh' }, error: null } as never)
  vi.mocked(supabase.auth.setSession).mockReset().mockResolvedValue({ data: { session: { user: { id: 'fiction' } } }, error: null } as never)
  vi.mocked(supabase.rpc).mockReset().mockImplementation((name, args) => (
    name === 'get_my_consistency'
      ? { abortSignal: async () => ({ data: consistencyFixture({ month: (args as { p_month?: string })?.p_month ?? '2026-10-01' }), error: null }) }
      : Promise.resolve({ data: null, error: { code: '42501' } })
  ) as never)
  window.history.replaceState(null, '', '/')
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('External requests are forbidden in tests') }))
})

afterEach(() => {
  cleanup()
  window.selahAppearance?.dispose()
  window.history.replaceState(null, '', '/')
})
