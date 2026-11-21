import { describe, expect, it, vi } from 'vitest'
import { createBereiaRankingRepository } from './ranking'

function client(data: unknown, error: unknown = null) {
  const rpc = vi.fn(() => ({ abortSignal: async () => ({ data, error }) }))
  return { rpc, repository: createBereiaRankingRepository({ rpc } as never) }
}
const player = { username: 'leitor_teste', answered: 10, correct: 7, accuracy: 70, score: 8, played: 2, solved: 1, avg_attempts: 2.5, games_played: 3, last_at: '2026-11-12T10:00:00Z' }
const payload = (game = 'geral', players: unknown[] = [player]) => ({ game, total_players: 1, matched_players: 1, total_items: 0, page: 0, size: 25, players })

describe('repositório do ranking da Bereia (owner)', () => {
  it('consulta o ranking do jogo com busca normalizada e descarta campos inesperados, como e-mail', async () => {
    const { rpc, repository } = client(payload('who', [{ ...player, email: 'segredo@example.com' }]))
    const ranking = await repository.ranking('who', '  @Leitor ')
    expect(rpc).toHaveBeenCalledWith('get_owner_bereia_ranking', { p_game: 'who', p_search: 'leitor', p_page: 0, p_size: 25 })
    expect(ranking.players[0]).not.toHaveProperty('email')
    expect(ranking.players[0].username).toBe('leitor_teste')
  })
  it('recusa jogo desconhecido e busca inválida antes de chamar o servidor', async () => {
    const { rpc, repository } = client(payload())
    await expect(repository.ranking('quiz' as never)).rejects.toThrow('Consulta inválida')
    await expect(repository.ranking('geral', 'a b')).rejects.toThrow('Consulta inválida')
    await expect(repository.ranking('geral', '', 0, 101)).rejects.toThrow('Consulta inválida')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('recusa resposta de outro jogo ou com números impossíveis e propaga erro do servidor', async () => {
    await expect(client(payload('claims')).repository.ranking('geral')).rejects.toThrow('Invalid bereia ranking')
    await expect(client(payload('geral', [{ ...player, correct: 11 }])).repository.ranking('geral')).rejects.toThrow('Invalid bereia ranking')
    await expect(client(payload('geral', [{ ...player, solved: 3 }])).repository.ranking('geral')).rejects.toThrow('Invalid bereia ranking')
    await expect(client(payload('geral', [{ ...player, avg_attempts: 9 }])).repository.ranking('geral')).rejects.toThrow('Invalid bereia ranking')
    await expect(client(null, { code: '42501' }).repository.ranking('geral')).rejects.toEqual({ code: '42501' })
  })
})
