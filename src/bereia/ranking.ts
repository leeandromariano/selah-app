import type { SupabaseClient } from '@supabase/supabase-js'

export type BereiaGame = 'geral' | 'claims' | 'who' | 'timeline' | 'verse'
export type BereiaPlayer = {
  username: string | null; answered: number; correct: number; accuracy: number; score: number
  played: number; solved: number; avg_attempts: number | null; games_played: number; last_at: string | null
}
export type BereiaRanking = { game: BereiaGame; total_players: number; matched_players: number; total_items: number; page: number; size: number; players: BereiaPlayer[] }

export const bereiaGames: { id: BereiaGame; name: string; description: string }[] = [
  { id: 'geral', name: 'Geral', description: 'Soma de acertos do quiz e dos jogos de resposta, mais os dias de Versículo Oculto resolvidos.' },
  { id: 'claims', name: 'Tá na Bíblia ou Tá Amarrado?', description: 'Acertos nas cartas de fato ou mito.' },
  { id: 'who', name: 'Quem disse isso?', description: 'Acertos nos personagens das frases.' },
  { id: 'timeline', name: 'Linha do Tempo', description: 'Acertos em qual acontecimento veio primeiro.' },
  { id: 'verse', name: 'Versículo Oculto', description: 'Desafios diários resolvidos e média de tentativas.' },
]

const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
type Rpc = Pick<SupabaseClient, 'rpc'>

export function createBereiaRankingRepository(client: Rpc) {
  return {
    async ranking(game: BereiaGame, search = '', page = 0, size = 25): Promise<BereiaRanking> {
      const normalized = search.trim().replace(/^@/, '').toLowerCase()
      if (!bereiaGames.some(item => item.id === game) || !/^[a-z0-9_]{0,24}$/.test(normalized)
        || !Number.isInteger(page) || page < 0 || page > 1000000 || !Number.isInteger(size) || size < 1 || size > 100) throw Error('Consulta inválida. Use parte de um username válido.')
      const { data, error } = await client.rpc('get_owner_bereia_ranking', { p_game: game, p_search: normalized, p_page: page, p_size: size }).abortSignal(AbortSignal.timeout(12000))
      if (error) throw error
      const v = data as BereiaRanking
      if (!v || v.game !== game || ![v.total_players, v.matched_players, v.total_items].every(count) || v.matched_players > v.total_players
        || v.page !== page || v.size !== size || !Array.isArray(v.players) || v.players.length > size
        || v.players.some(p => !p || (p.username !== null && !/^[a-z][a-z0-9_]{2,23}$/.test(p.username))
          || ![p.answered, p.correct, p.score, p.played, p.solved, p.games_played].every(count) || p.correct > p.answered || p.solved > p.played
          || !Number.isInteger(p.accuracy) || p.accuracy < 0 || p.accuracy > 100
          || (p.avg_attempts !== null && (typeof p.avg_attempts !== 'number' || p.avg_attempts < 1 || p.avg_attempts > 4))
          || (p.last_at !== null && typeof p.last_at !== 'string'))) throw Error('Invalid bereia ranking')
      // Projeção explícita: descarta qualquer campo inesperado (por exemplo, e-mail).
      return { game, total_players: v.total_players, matched_players: v.matched_players, total_items: v.total_items, page, size,
        players: v.players.map(p => ({ username: p.username, answered: p.answered, correct: p.correct, accuracy: p.accuracy, score: p.score,
          played: p.played, solved: p.solved, avg_attempts: p.avg_attempts, games_played: p.games_played, last_at: p.last_at })) }
    },
  }
}
