import type { SupabaseClient } from '@supabase/supabase-js'

export type QuizMode = 'antigo' | 'novo' | 'biblia'
export type QuizLevel = 1 | 2 | 3 | 4
export type QuizQuestion = { id: string; testament: 'antigo' | 'novo'; level: QuizLevel; prompt: string; options: string[] }
export type QuizAnswerResult = { correct: boolean; correct_index: number; reference: string; counted: boolean }
export type QuizStats = { answered: number; correct: number; total_questions: number }
export type QuizPlayer = { username: string | null; answered: number; correct: number; accuracy: number; antigo_correct: number; novo_correct: number; last_answered_at: string }
export type QuizRanking = { total_players: number; matched_players: number; total_questions: number; page: number; size: number; players: QuizPlayer[] }

export const quizModes: { id: QuizMode; name: string; description: string }[] = [
  { id: 'antigo', name: 'Antigo Testamento', description: 'Da criação aos profetas.' },
  { id: 'novo', name: 'Novo Testamento', description: 'Dos Evangelhos ao Apocalipse.' },
  { id: 'biblia', name: 'Bíblia toda', description: 'Perguntas dos dois testamentos misturadas.' },
]

export const quizLevels: { id: QuizLevel; name: string; description: string }[] = [
  { id: 1, name: 'Iniciante', description: 'Histórias e personagens que todo mundo conhece.' },
  { id: 2, name: 'Intermediário', description: 'Detalhes dos relatos e dos livros.' },
  { id: 3, name: 'Avançado', description: 'Personagens secundários, lugares e citações.' },
  { id: 4, name: 'Bigode grosso', description: 'Só para quem leu a Bíblia com lupa.' },
]

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
type Rpc = Pick<SupabaseClient, 'rpc'>

export function createQuizRepository(client: Rpc) {
  async function call(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(12000))
    if (error) throw error
    return data as unknown
  }
  return {
    async start(mode: QuizMode, level: QuizLevel, size = 10): Promise<QuizQuestion[]> {
      if (!quizModes.some(item => item.id === mode) || !quizLevels.some(item => item.id === level) || !Number.isInteger(size) || size < 1 || size > 20) throw Error('Modalidade inválida.')
      const data = await call('quiz_start', { p_mode: mode, p_level: level, p_count: size })
      if (!Array.isArray(data) || data.length > size) throw Error('Invalid quiz response')
      // Projeção explícita: nunca guardar campos inesperados (por exemplo, a resposta certa).
      return data.map(item => {
        const q = item as QuizQuestion
        if (!q || typeof q.id !== 'string' || !uuid.test(q.id) || !['antigo', 'novo'].includes(q.testament) || q.level !== level || typeof q.prompt !== 'string'
          || !Array.isArray(q.options) || q.options.length !== 4 || q.options.some(option => typeof option !== 'string')) throw Error('Invalid quiz question')
        return { id: q.id, testament: q.testament, level: q.level, prompt: q.prompt, options: [...q.options] }
      })
    },
    async answer(questionId: string, selected: number): Promise<QuizAnswerResult> {
      if (!uuid.test(questionId) || !Number.isInteger(selected) || selected < 0 || selected > 3) throw Error('Resposta inválida.')
      const v = await call('quiz_answer', { p_question_id: questionId, p_selected: selected }) as QuizAnswerResult
      if (!v || typeof v.correct !== 'boolean' || !Number.isInteger(v.correct_index) || v.correct_index < 0 || v.correct_index > 3
        || typeof v.reference !== 'string' || typeof v.counted !== 'boolean' || v.correct !== (v.correct_index === selected)) throw Error('Invalid quiz answer')
      return { correct: v.correct, correct_index: v.correct_index, reference: v.reference, counted: v.counted }
    },
    async stats(): Promise<QuizStats> {
      const v = await call('get_my_quiz_stats', {}) as QuizStats
      if (!v || !count(v.answered) || !count(v.correct) || !count(v.total_questions) || v.correct > v.answered) throw Error('Invalid quiz stats')
      return { answered: v.answered, correct: v.correct, total_questions: v.total_questions }
    },
    async ranking(search = '', page = 0, size = 25): Promise<QuizRanking> {
      const normalized = search.trim().replace(/^@/, '').toLowerCase()
      if (!/^[a-z0-9_]{0,24}$/.test(normalized) || !Number.isInteger(page) || page < 0 || page > 1000000 || !Number.isInteger(size) || size < 1 || size > 100) throw Error('Consulta inválida. Use parte de um username válido.')
      const v = await call('get_owner_quiz_ranking', { p_search: normalized, p_page: page, p_size: size }) as QuizRanking
      if (!v || ![v.total_players, v.matched_players, v.total_questions].every(count) || v.matched_players > v.total_players
        || v.page !== page || v.size !== size || !Array.isArray(v.players) || v.players.length > size
        || v.players.some(p => (p.username !== null && !/^[a-z][a-z0-9_]{2,23}$/.test(p.username))
          || ![p.answered, p.correct, p.antigo_correct, p.novo_correct].every(count) || p.correct > p.answered
          || !Number.isInteger(p.accuracy) || p.accuracy < 0 || p.accuracy > 100 || typeof p.last_answered_at !== 'string')) throw Error('Invalid quiz ranking')
      return { total_players: v.total_players, matched_players: v.matched_players, total_questions: v.total_questions, page, size,
        players: v.players.map(p => ({ username: p.username, answered: p.answered, correct: p.correct, accuracy: p.accuracy, antigo_correct: p.antigo_correct, novo_correct: p.novo_correct, last_answered_at: p.last_answered_at })) }
    },
  }
}
