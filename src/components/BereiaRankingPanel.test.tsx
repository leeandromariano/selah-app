import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { BereiaRankingPanel } from './BereiaRankingPanel'

vi.mock('./QuizRankingPanel', () => ({ QuizRankingPanel: () => <div>Ranking do quiz fictício</div> }))

const base = { answered: 0, correct: 0, accuracy: 0, score: 0, played: 0, solved: 0, avg_attempts: null, games_played: 0, last_at: '2026-11-12T10:00:00Z' }
const players = [
  { ...base, username: 'ana_fiel', answered: 20, correct: 18, accuracy: 90, score: 19, solved: 1, played: 2, avg_attempts: 2.5, games_played: 3 },
  { ...base, username: null, answered: 5, correct: 2, accuracy: 40, score: 2, games_played: 1 },
]
function boundary(result: { data: unknown; error: unknown } | ((game: string) => { data: unknown; error: unknown })) {
  vi.mocked(supabase.rpc).mockImplementation(((name: string, args: { p_game: string }) => ({ abortSignal: async () => name === 'get_owner_bereia_ranking' ? (typeof result === 'function' ? result(args.p_game) : result) : { data: null, error: { code: '42501' } } })) as never)
}
const ok = (game: string, matched = 2) => ({ data: { game, total_players: 2, matched_players: matched, total_items: game === 'geral' ? 0 : 24, page: 0, size: 25, players }, error: null })

describe('Ranking da Bereia (owner)', () => {
  it('abre no ranking geral com posição, pontos e versículos resolvidos', async () => {
    boundary(game => ok(game))
    render(<BereiaRankingPanel />)
    const table = await screen.findByRole('table')
    expect(table).toHaveTextContent('1º')
    expect(table).toHaveTextContent('@ana_fiel')
    expect(table).toHaveTextContent('Pontos')
    expect(table).toHaveTextContent('Versículos resolvidos')
    expect(table).toHaveTextContent('Conta legada sem username')
    expect(screen.getByText('Participantes').closest('.stat')).toHaveTextContent('2')
  })
  it('troca de jogo e mostra as colunas daquele jogo', async () => {
    boundary(game => ok(game))
    const user = userEvent.setup()
    render(<BereiaRankingPanel />)
    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Versículo Oculto' }))
    expect(await screen.findByRole('columnheader', { name: 'Média de tentativas' })).toBeVisible()
    expect(screen.getByRole('table')).toHaveTextContent('2,5')
    expect(supabase.rpc).toHaveBeenCalledWith('get_owner_bereia_ranking', { p_game: 'verse', p_search: '', p_page: 0, p_size: 25 })
    await user.click(screen.getByRole('button', { name: 'Quem disse isso?' }))
    expect(await screen.findByRole('columnheader', { name: 'Aproveitamento' })).toBeVisible()
    expect(screen.getByRole('table')).toHaveTextContent('90%')
  })
  it('mostra o ranking do quiz bíblico na aba própria', async () => {
    boundary(game => ok(game))
    const user = userEvent.setup()
    render(<BereiaRankingPanel />)
    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Quiz bíblico' }))
    expect(screen.getByText('Ranking do quiz fictício')).toBeVisible()
  })
  it('busca por username normalizado', async () => {
    boundary(game => ok(game, 1))
    const user = userEvent.setup()
    render(<BereiaRankingPanel />)
    await screen.findByRole('table')
    await user.type(screen.getByLabelText('Buscar por username'), '@Ana')
    await user.click(screen.getByRole('button', { name: 'Buscar participantes' }))
    await screen.findByText(/1 participantes encontrados/)
    expect(supabase.rpc).toHaveBeenCalledWith('get_owner_bereia_ranking', { p_game: 'geral', p_search: 'ana', p_page: 0, p_size: 25 })
  })
  it('mostra estado vazio e erro de acesso com opção de repetir', async () => {
    boundary({ data: { game: 'geral', total_players: 0, matched_players: 0, total_items: 0, page: 0, size: 25, players: [] }, error: null })
    const { unmount } = render(<BereiaRankingPanel />)
    expect(await screen.findByText('Nenhum participante encontrado.')).toBeVisible()
    unmount()
    boundary({ data: null, error: { code: '42501' } })
    const user = userEvent.setup()
    render(<BereiaRankingPanel />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso exclusivo do proprietário')
    boundary(game => ok(game))
    await user.click(screen.getByRole('button', { name: 'Repetir consulta' }))
    expect(await screen.findByRole('table')).toBeVisible()
  })
})
