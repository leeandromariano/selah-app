import { useEffect, useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import { libraryBoundary, olderPublications } from '../test/libraryBoundary'
import { ReaderLibrary } from './ReaderLibrary'
import type { EditorialSelection } from './ReaderLibrary'

function Harness() {
  const [page, setPage] = useState('editorial')
  useEffect(() => { const change = () => setPage(location.hash.slice(1)); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change) }, [])
  return <AuthProvider><ReaderLibrary page={page} editorialEnabled /></AuthProvider>
}
function JourneyHarness() {
  const [page, setPage] = useState('editorial')
  const [selection, setSelection] = useState<EditorialSelection | null>(null)
  useEffect(() => { const change = () => setPage(location.hash.slice(1)); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change) }, [])
  return <AuthProvider>{page === 'journey' ? <button onClick={() => setPage('leitura/' + olderPublications[0].id + '/retomar')}>Retomar</button> : <><button onClick={() => setPage('journey')}>Ir para jornada</button><ReaderLibrary page={page} editorialEnabled initialEditorialSelection={selection} onEditorialSelection={setSelection} /></>}</AuthProvider>
}
describe('editorial reading integration', () => {
  it('records exactly one opening before navigating from a theme', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-reader' } } }, error: null } as never)
    const boundary = libraryBoundary(olderPublications)
    const fallback = vi.mocked(supabase.rpc).getMockImplementation()!
    vi.mocked(supabase.rpc).mockImplementation((name, args) => name === 'reader_editorial_catalog'
      ? { abortSignal: async () => ({ data: args?.p_kind === 'themes' ? [{ id: olderPublications[0].id, name: 'Hope', slug: 'hope', description: null }] : [{ ...olderPublications[0] }], error: null }) } as never
      : fallback(name, args))
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(await screen.findByRole('button', { name: /hope/i }))
    await user.click(await screen.findByRole('button', { name: /Paz em meio ao caminho/i }))
    await waitFor(() => expect(location.hash).toBe('#leitura/' + olderPublications[0].id))
    expect(boundary.historyQuery.insert).toHaveBeenCalledExactlyOnceWith({ devotional_id: olderPublications[0].id })
  })
  it('mantem o retorno da serie durante o carregamento do proximo episodio', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-reader' } } }, error: null } as never)
    libraryBoundary(olderPublications)
    const fallback = vi.mocked(supabase.rpc).getMockImplementation()!
    let episodeCalls = 0
    vi.mocked(supabase.rpc).mockImplementation((name, args) => {
      if (name !== 'reader_editorial_catalog') return fallback(name, args)
      if (args?.p_kind === 'episodes' && ++episodeCalls > 1) return { abortSignal: () => new Promise(() => {}) } as never
      const data = args?.p_kind === 'series' ? [{ id: olderPublications[0].id, title: 'Path', slug: 'path', description: null }]
        : args?.p_kind === 'episodes' ? [{ ...olderPublications[0] }] : []
      return { abortSignal: async () => ({ data, error: null }) } as never
    })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(await screen.findByRole('button', { name: /s.ries/i }))
    await user.click(await screen.findByRole('button', { name: /path/i }))
    await user.click(await screen.findByRole('button', { name: /Paz em meio ao caminho/i }))
    expect(await screen.findByRole('button', { name: /Voltar à série Path/i })).toBeVisible()
    expect(screen.getByText(/Buscando próximo episódio/)).toBeVisible()
  })

  it('revalida o devocional ao navegar e nao exibe conteudo retirado', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-reader' } } }, error: null } as never)
    const boundary = libraryBoundary(olderPublications)
    const fallback = vi.mocked(supabase.rpc).getMockImplementation()!
    vi.mocked(supabase.rpc).mockImplementation((name, args) => name === 'reader_editorial_catalog'
      ? { abortSignal: async () => ({ data: args?.p_kind === 'themes' ? [{ id: olderPublications[0].id, name: 'Hope', slug: 'hope', description: null }] : [{ ...olderPublications[0] }], error: null }) } as never
      : fallback(name, args))
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(await screen.findByRole('button', { name: /hope/i }))
    const devotional = await screen.findByRole('button', { name: /Paz em meio ao caminho/i })
    boundary.publicationsQuery.range.mockResolvedValue({ data: [], error: null })
    await user.click(devotional)
    expect(await screen.findByText(/Devocional não encontrado ou indisponível/)).toBeVisible()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('preserva a serie na sessao ao retomar sem gravar outra abertura', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-reader' } } }, error: null } as never)
    const boundary = libraryBoundary(olderPublications)
    const fallback = vi.mocked(supabase.rpc).getMockImplementation()!
    vi.mocked(supabase.rpc).mockImplementation((name, args) => {
      if (name !== 'reader_editorial_catalog') return fallback(name, args)
      const data = args?.p_kind === 'series' ? [{ id: olderPublications[0].id, title: 'Path', slug: 'path', description: null }]
        : args?.p_kind === 'episodes' ? [{ ...olderPublications[0] }] : []
      return { abortSignal: async () => ({ data, error: null }) } as never
    })
    const user = userEvent.setup()
    render(<JourneyHarness />)
    await user.click(await screen.findByRole('button', { name: /s.ries/i }))
    await user.click(await screen.findByRole('button', { name: /path/i }))
    await user.click(await screen.findByRole('button', { name: /Paz em meio ao caminho/i }))
    expect(await screen.findByRole('button', { name: /Voltar à série Path/i })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Ir para jornada' }))
    await user.click(screen.getByRole('button', { name: 'Retomar' }))
    expect(await screen.findByRole('button', { name: /Voltar à série Path/i })).toBeVisible()
    expect(boundary.historyQuery.insert).toHaveBeenCalledTimes(1)
  })

})
