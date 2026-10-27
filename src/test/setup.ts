import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({ supabase: {
  auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn(), setSession: vi.fn(), signOut: vi.fn(), resetPasswordForEmail: vi.fn(), updateUser: vi.fn() },
  functions: { invoke: vi.fn() },
  rpc: vi.fn(),
  from: vi.fn(),
} }))

beforeEach(() => {
  const emptyQuery = { select: vi.fn(), eq: vi.fn(), lte: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValue({ data: [], error: null }) }
  for (const method of ['select', 'eq', 'lte', 'order'] as const) emptyQuery[method].mockReturnValue(emptyQuery)
  vi.mocked(supabase.from).mockReset().mockReturnValue(emptyQuery as never)
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null })
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } } as never)
  for (const method of ['signUp', 'signInWithPassword', 'signOut', 'resetPasswordForEmail', 'updateUser'] as const) vi.mocked(supabase.auth[method]).mockReset().mockResolvedValue({ data: {}, error: null } as never)
  vi.mocked(supabase.functions.invoke).mockReset().mockResolvedValue({ data: { access_token: 'fiction-access', refresh_token: 'fiction-refresh' }, error: null } as never)
  vi.mocked(supabase.auth.setSession).mockReset().mockResolvedValue({ data: { session: { user: { id: 'fiction' } } }, error: null } as never)
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { code: '42501' } } as never)
  window.history.replaceState(null, '', '/')
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('External requests are forbidden in tests') }))
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})
