import { render, renderHook, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BottomNav, StreakBadge, TopNav } from './GlobalNav'
import { useViewport } from './navigation'
import { supabase } from '../lib/supabase'
import { consistencyFixture } from '../test/consistencyBoundary'

function media(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches, media: '(max-width: 900px)', addEventListener: vi.fn(), removeEventListener: vi.fn() })))
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('navegação global', () => {
  it('topo (computador): links das páginas principais, página atual marcada e extras só quando existem', () => {
    render(<TopNav page="biblia/nvt/gn/1" extras={[{ id: 'owner', name: 'Painel OWNER' }]} />)
    const nav = screen.getByRole('navigation', { name: 'Navegação do topo' })
    expect(within(nav).getAllByRole('link').map(link => link.textContent)).toEqual(['Início', 'Devocionais', 'Bíblia', 'Bereia', 'Minha Jornada', 'Painel OWNER'])
    expect(within(nav).getByRole('link', { name: 'Bíblia' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current')
  })
  it('um devocional aberto mantém "Devocionais" como página atual', () => {
    render(<TopNav page="leitura/abc" extras={[]} />)
    expect(screen.getByRole('link', { name: 'Devocionais' })).toHaveAttribute('aria-current', 'page')
  })
  it('barra inferior (celular): cinco atalhos com a página atual marcada', () => {
    render(<BottomNav page="bereia/quiz" />)
    const nav = screen.getByRole('navigation', { name: 'Atalhos' })
    expect(within(nav).getAllByRole('link').map(link => link.textContent)).toEqual(['Início', 'Devocionais', 'Bíblia', 'Bereia', 'Jornada'])
    expect(within(nav).getByRole('link', { name: 'Bereia' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Jornada' })).toHaveAttribute('href', '#minha-jornada')
  })
  it('detecta o tamanho da tela e trata matchMedia ausente ou incompleto como indisponível', () => {
    media(true); expect(renderHook(() => useViewport()).result.current).toBe('mobile')
    media(false); expect(renderHook(() => useViewport()).result.current).toBe('desktop')
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    expect(renderHook(() => useViewport()).result.current).toBeNull()
    vi.stubGlobal('matchMedia', undefined)
    expect(renderHook(() => useViewport()).result.current).toBeNull()
  })
  it('selo da chama mostra a ofensiva atual e leva à Minha Jornada', async () => {
    vi.mocked(supabase.rpc).mockImplementation(() => ({ abortSignal: async () => ({ data: consistencyFixture({ status: 'pending_today', current_streak: 4, best_streak: 4, total_days: 4, total_devotionals: 4, last_completed_day: '2026-10-27' }), error: null }) }) as never)
    render(<StreakBadge page="inicio" />)
    const badge = await screen.findByRole('link', { name: 'Ofensiva atual: 4 dias' })
    expect(badge).toHaveAttribute('href', '#minha-jornada')
    expect(badge).toHaveTextContent('4')
  })
  it('sem resposta do servidor o selo some, sem quebrar o cabeçalho', async () => {
    vi.mocked(supabase.rpc).mockImplementation(() => ({ abortSignal: async () => ({ data: null, error: { code: '42501' } }) }) as never)
    const { container } = render(<StreakBadge page="inicio" />)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(container).toBeEmptyDOMElement()
  })
})
