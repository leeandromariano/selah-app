import type { SupabaseClient } from '@supabase/supabase-js'

// CORAM Wrapped: o retrato do mês ou do ano, calculado no servidor só com os dados do próprio leitor.
export type WrappedKind = 'month' | 'year'
export const wrappedGames = ['quiz', 'mito', 'quem-disse', 'linha-do-tempo', 'versiculo'] as const
export type WrappedGame = (typeof wrappedGames)[number]
export type WrappedData = {
  kind: WrappedKind; year: number; month: number | null; start: string; end: string; partial: boolean
  presence: { days: number; completed: number; longest_streak: number }
  books: { key: string; count: number }[]
  games: { game: WrappedGame; answered: number; correct: number }[]
  verse: { reference: string; title: string; opens: number } | null
}

const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const day = /^\d{4}-\d{2}-\d{2}$/
type Rpc = Pick<SupabaseClient, 'rpc'>
const friendly = ['Este período ainda não começou', 'Período inválido']

export function createWrappedRepository(client: Rpc) {
  return {
    async get(kind: WrappedKind, year: number, month: number | null): Promise<WrappedData> {
      if ((kind !== 'month' && kind !== 'year') || !Number.isInteger(year) || year < 2025 || year > 2100
        || (kind === 'month' && (month === null || !Number.isInteger(month) || month < 1 || month > 12)) || (kind === 'year' && month !== null)) throw Error('Período inválido.')
      const { data, error } = await client.rpc('get_my_wrapped', { p_kind: kind, p_year: year, p_month: month }).abortSignal(AbortSignal.timeout(15000))
      if (error) {
        const message = typeof error.message === 'string' ? error.message : ''
        throw Error(friendly.some(text => message.startsWith(text)) ? message : 'Não foi possível montar o seu Wrapped agora. Tente de novo.')
      }
      const v = data as Partial<WrappedData> & { bereia?: { games?: unknown } } | null
      const presence = v?.presence
      const games = v?.bereia?.games
      if (!v || v.kind !== kind || v.year !== year || (v.month ?? null) !== month || typeof v.start !== 'string' || !day.test(v.start) || typeof v.end !== 'string' || !day.test(v.end)
        || typeof v.partial !== 'boolean' || !presence || !count(presence.days) || !count(presence.completed) || !count(presence.longest_streak) || presence.longest_streak > presence.days
        || !Array.isArray(v.books) || !Array.isArray(games)) throw Error('Resposta inválida do servidor.')
      // Projeção explícita: só os campos conhecidos, e só os jogos conhecidos.
      const books = v.books.flatMap(item => (item && typeof item.key === 'string' && item.key.length > 0 && item.key.length <= 60 && count(item.count) ? [{ key: item.key, count: item.count }] : []))
      const list = (games as { game?: unknown; answered?: unknown; correct?: unknown }[]).flatMap(item => (item && wrappedGames.some(name => name === item.game) && count(item.answered) && count(item.correct) && item.correct <= item.answered
        ? [{ game: item.game as WrappedGame, answered: item.answered, correct: item.correct }] : []))
      const verse = v.verse && typeof v.verse.reference === 'string' && typeof v.verse.title === 'string' && count(v.verse.opens) ? { reference: v.verse.reference, title: v.verse.title, opens: v.verse.opens } : null
      return { kind, year, month, start: v.start, end: v.end, partial: v.partial, presence: { days: presence.days, completed: presence.completed, longest_streak: presence.longest_streak }, books, games: list, verse }
    },
  }
}
