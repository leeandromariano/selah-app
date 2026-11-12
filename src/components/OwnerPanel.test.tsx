import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { supabase } from '../lib/supabase'
import { openMenu } from '../test/menu'

vi.mock('./CommunityPanel', () => ({ CommunityPanel: () => <div>Comunidade fictícia</div> }))
vi.mock('./ModerationPanel', () => ({ ModerationPanel: () => <div>Moderação fictícia</div>, ModerationLink: () => null }))
vi.mock('./QuizRankingPanel', () => ({ QuizRankingPanel: () => <div>Ranking do quiz fictício</div> }))
vi.mock('./ReaderLibrary', () => ({ ReaderLibrary: () => <div>Leitor fictício</div> }))

const session = (id: string) => ({ user: { id, user_metadata: { role: 'owner' } } }) as never
function authEvent(value: ReturnType<typeof session> | null) {
  act(() => { vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0](value ? 'SIGNED_IN' : 'SIGNED_OUT', value) })
}
function rpc(owner: () => Promise<{ data: unknown; error: unknown }>, admin = false) {
  vi.mocked(supabase.rpc).mockImplementation((name) => (name === 'get_my_discussion_access'
    ? { abortSignal: owner }
    : Promise.resolve({ data: null, error: admin && name === 'devotional_open_counts' ? null : { code: '42501' } })) as never)
}
function path(hash: string) { window.history.replaceState(null, '', `/#${hash}`) }

describe('Painel OWNER', () => {
  it.each([['owner', 'Painel OWNER'], ['owner/comunidade', 'Comunidade fictícia'], ['owner/moderacao', 'Moderação fictícia'], ['owner/quiz', 'Ranking do quiz fictício']])('abre %s após confirmação do servidor', async (route, content) => {
    path(route); rpc(async () => ({ data: true, error: null }))
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: session('owner') }, error: null })
    render(<App />)
    expect(await screen.findByText(content, { selector: route === 'owner' ? 'h1' : 'div' })).toBeInTheDocument()
    await openMenu()
    expect(screen.getByRole('link', { name: 'Painel OWNER' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Painel administrativo' })).not.toBeInTheDocument()
  })

  it.each([['leitor', false, null], ['admin legado', true, null], ['resposta inválida', false, 'true'], ['RPC indisponível', false, undefined]])('nega acesso para %s', async (_label, admin, result) => {
    path('owner/comunidade')
    rpc(async () => result === undefined ? Promise.reject(Error('offline')) : ({ data: result, error: null }), admin)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: session('fiction') }, error: null })
    render(<App />)
    expect(await screen.findByText('Acesso restrito ao OWNER.')).toBeInTheDocument()
    await openMenu()
    expect(screen.queryByRole('link', { name: 'Painel OWNER' })).not.toBeInTheDocument()
    expect(screen.queryByText('Comunidade fictícia')).not.toBeInTheDocument()
    if (admin) expect(await screen.findByRole('link', { name: 'Painel administrativo' })).toBeInTheDocument()
  })

  it('OWNER herda o acesso administrativo e tem atalho para gerenciar devocionais', async () => {
    path('owner')
    rpc(async () => ({ data: true, error: null }), true)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: session('owner') }, error: null })
    render(<App />)
    await openMenu()
    expect(await screen.findByRole('link', { name: 'Painel OWNER' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Painel administrativo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gerenciar devocionais' })).toHaveAttribute('href', '#admin')
  })

  it('descarta autorização atrasada na troca de sessão e no logout', async () => {
    path('owner')
    let resolveFirst!: (result: { data: boolean; error: null }) => void
    const first = new Promise<{ data: boolean; error: null }>(resolve => { resolveFirst = resolve })
    let calls = 0
    rpc(() => ++calls === 1 ? first : Promise.resolve({ data: false, error: null }))
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: session('first') }, error: null })
    render(<App />)
    await waitFor(() => expect(calls).toBe(1))
    authEvent(session('second'))
    expect(await screen.findByText('Acesso restrito ao OWNER.')).toBeInTheDocument()
    await act(async () => { resolveFirst({ data: true, error: null }); await first })
    await openMenu()
    expect(screen.queryByRole('link', { name: 'Painel OWNER' })).not.toBeInTheDocument()
    authEvent(null)
    expect(screen.queryByRole('link', { name: 'Painel OWNER' })).not.toBeInTheDocument()
  })

  it('remove o painel após logout de OWNER e mantém o leitor disponível para uma sessão comum', async () => {
    path('inicio')
    let allowed = true
    rpc(async () => ({ data: allowed, error: null }))
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: session('owner') }, error: null })
    render(<App />)
    await openMenu()
    expect(await screen.findByRole('link', { name: 'Painel OWNER' })).toBeInTheDocument()
    expect(screen.getByText('Leitor fictício')).toBeInTheDocument()
    authEvent(null)
    expect(screen.queryByRole('link', { name: 'Painel OWNER' })).not.toBeInTheDocument()
    allowed = false
    authEvent(session('reader'))
    expect(await screen.findByText('Leitor fictício')).toBeInTheDocument()
    await openMenu()
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Painel OWNER' })).not.toBeInTheDocument())
  })
})
