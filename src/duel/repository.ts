import type { SupabaseClient } from '@supabase/supabase-js'
import type { QuizLevel, QuizMode } from '../quiz/repository'
import { quizLevels, quizModes } from '../quiz/repository'

// Bereia 1v1 (Duelo Relâmpago): as perguntas são sorteadas uma vez pelo servidor e todos respondem as mesmas, cronometradas.
export const duelSizes = [5, 10] as const
export type DuelSize = (typeof duelSizes)[number]
export const duelSecondsPerQuestion = 15

export type DuelQuestion = { id: string; prompt: string; options: string[] }
export type DuelAnswer = { question_id: string; selected: number; correct: boolean; correct_index: number; reference: string }
export type DuelState = {
  code: string; mode: QuizMode; level: QuizLevel; size: DuelSize; creator: string | null; is_creator: boolean; finished: boolean
  questions: DuelQuestion[]; answers: DuelAnswer[]
}
export type DuelAnswerResult = { correct: boolean; correct_index: number; reference: string; counted: boolean; finished: boolean }
export type DuelPlayer = { username: string | null; correct: number; total_ms: number; is_me: boolean; is_creator: boolean }
export type DuelResult = { code: string; mode: QuizMode; level: QuizLevel; size: DuelSize; players: DuelPlayer[]; waiting: number }
export type DuelSummary = { code: string; mode: QuizMode; level: QuizLevel; size: DuelSize; created_at: string; creator: string | null; is_creator: boolean; finished: boolean; correct: number }

export const duelCodePattern = /^[a-z0-9]{10}$/
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const nameOrNull = (value: unknown) => (typeof value === 'string' && /^[a-z][a-z0-9_]{2,23}$/.test(value) ? value : null)
const isMode = (value: unknown): value is QuizMode => quizModes.some(item => item.id === value)
const isLevel = (value: unknown): value is QuizLevel => quizLevels.some(item => item.id === value)
const isSize = (value: unknown): value is DuelSize => duelSizes.some(item => item === value)
type Rpc = Pick<SupabaseClient, 'rpc'>

// Mensagens do servidor que vale mostrar como estão (já em português e sem detalhes técnicos).
const friendly = ['Ainda não há perguntas suficientes', 'Você criou muitos duelos', 'Duelo não encontrado', 'Este duelo já está cheio', 'Termine o duelo']

export function createDuelRepository(client: Rpc) {
  async function call(name: string, args: Record<string, unknown>, fallback: string) {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(12000))
    if (error) {
      const message = typeof error.message === 'string' ? error.message : ''
      throw Error(friendly.some(text => message.startsWith(text)) ? message : fallback)
    }
    return data as unknown
  }
  const checkCode = (code: string) => { if (!duelCodePattern.test(code)) throw Error('Duelo não encontrado.') }
  return {
    async create(mode: QuizMode, level: QuizLevel, size: DuelSize): Promise<string> {
      if (!isMode(mode) || !isLevel(level) || !isSize(size)) throw Error('Escolha modalidade, nível e tamanho válidos.')
      const data = await call('duel_create', { p_mode: mode, p_level: level, p_size: size }, 'Não foi possível criar o duelo agora. Tente de novo.') as { code?: unknown } | null
      if (!data || typeof data.code !== 'string' || !duelCodePattern.test(data.code)) throw Error('Resposta inválida do servidor.')
      return data.code
    },
    async open(code: string): Promise<DuelState> {
      checkCode(code)
      const v = await call('duel_open', { p_code: code }, 'Não foi possível abrir o duelo. Verifique a conexão e tente de novo.') as DuelState | null
      if (!v || v.code !== code || !isMode(v.mode) || !isLevel(v.level) || !isSize(v.size) || typeof v.is_creator !== 'boolean' || typeof v.finished !== 'boolean'
        || !Array.isArray(v.questions) || v.questions.length !== v.size || !Array.isArray(v.answers)) throw Error('Resposta inválida do servidor.')
      // Projeção explícita: só os campos conhecidos. As perguntas chegam SEM a resposta certa.
      const questions = v.questions.map(q => {
        if (!q || typeof q.id !== 'string' || !uuid.test(q.id) || typeof q.prompt !== 'string' || !Array.isArray(q.options) || q.options.length !== 4 || q.options.some(o => typeof o !== 'string')) throw Error('Resposta inválida do servidor.')
        return { id: q.id, prompt: q.prompt, options: [...q.options] }
      })
      const answers = v.answers.flatMap(a => (a && uuid.test(String(a.question_id)) && Number.isInteger(a.selected) && a.selected >= -1 && a.selected <= 3 && typeof a.correct === 'boolean'
        && Number.isInteger(a.correct_index) && a.correct_index >= 0 && a.correct_index <= 3 && typeof a.reference === 'string'
        ? [{ question_id: a.question_id, selected: a.selected, correct: a.correct, correct_index: a.correct_index, reference: a.reference }] : []))
      return { code, mode: v.mode, level: v.level, size: v.size, creator: nameOrNull(v.creator), is_creator: v.is_creator, finished: v.finished, questions, answers }
    },
    async answer(code: string, questionId: string, selected: number, elapsedMs: number): Promise<DuelAnswerResult> {
      checkCode(code)
      if (!uuid.test(questionId) || !Number.isInteger(selected) || selected < -1 || selected > 3) throw Error('Resposta inválida.')
      const elapsed = Math.max(0, Math.min(duelSecondsPerQuestion * 1000, Math.round(Number.isFinite(elapsedMs) ? elapsedMs : duelSecondsPerQuestion * 1000)))
      const v = await call('duel_answer', { p_code: code, p_question_id: questionId, p_selected: selected, p_elapsed_ms: elapsed }, 'Não foi possível registrar sua resposta. Tente de novo.') as DuelAnswerResult | null
      if (!v || typeof v.correct !== 'boolean' || !Number.isInteger(v.correct_index) || v.correct_index < 0 || v.correct_index > 3 || typeof v.reference !== 'string'
        || typeof v.counted !== 'boolean' || typeof v.finished !== 'boolean' || v.correct !== (v.correct_index === selected)) throw Error('Resposta inválida do servidor.')
      return { correct: v.correct, correct_index: v.correct_index, reference: v.reference, counted: v.counted, finished: v.finished }
    },
    async result(code: string): Promise<DuelResult> {
      checkCode(code)
      const v = await call('duel_result', { p_code: code }, 'Não foi possível carregar o placar agora.') as DuelResult | null
      if (!v || v.code !== code || !isMode(v.mode) || !isLevel(v.level) || !isSize(v.size) || !count(v.waiting) || !Array.isArray(v.players) || v.players.length > 20
        || v.players.some(p => !p || !count(p.correct) || p.correct > v.size || !count(p.total_ms) || typeof p.is_me !== 'boolean' || typeof p.is_creator !== 'boolean')) throw Error('Resposta inválida do servidor.')
      return { code, mode: v.mode, level: v.level, size: v.size, waiting: v.waiting,
        players: v.players.map(p => ({ username: nameOrNull(p.username), correct: p.correct, total_ms: p.total_ms, is_me: p.is_me, is_creator: p.is_creator })) }
    },
    async mine(): Promise<DuelSummary[]> {
      const data = await call('duel_mine', {}, 'Não foi possível carregar seus duelos.') as unknown
      if (!Array.isArray(data)) throw Error('Resposta inválida do servidor.')
      return data.flatMap((item: Partial<DuelSummary> | null) => (item && typeof item.code === 'string' && duelCodePattern.test(item.code) && isMode(item.mode) && isLevel(item.level) && isSize(item.size)
        && typeof item.created_at === 'string' && typeof item.is_creator === 'boolean' && typeof item.finished === 'boolean' && typeof item.correct === 'number' && count(item.correct)
        ? [{ code: item.code, mode: item.mode, level: item.level, size: item.size, created_at: item.created_at, creator: nameOrNull(item.creator), is_creator: item.is_creator, finished: item.finished, correct: item.correct }] : []))
    },
  }
}
