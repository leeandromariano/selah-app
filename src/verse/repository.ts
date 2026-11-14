import type { SupabaseClient } from '@supabase/supabase-js'
import type { VerseBlank } from './mask'

export type VerseState = {
  number: number; reference: string; max_attempts: number; blanks: VerseBlank[]
  attempts: { results: boolean[] }[]; finished: boolean; solved: boolean; streak: number; answers: string[] | null
}
export type VerseGuessResult = VerseState & { results: boolean[] }

const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
type Rpc = Pick<SupabaseClient, 'rpc'>

function parseState(value: unknown): VerseState {
  const v = value as VerseState
  const blanks = v?.blanks
  if (!v || !count(v.number) || v.number < 1 || typeof v.reference !== 'string' || !v.reference.trim() || v.max_attempts !== 4
    || !Array.isArray(blanks) || blanks.length < 2 || blanks.length > 3
    || blanks.some(b => !b || !Number.isInteger(b.index) || b.index < 1 || !Number.isInteger(b.length) || b.length < 1 || b.length > 40 || typeof b.prev !== 'string')
    || !Array.isArray(v.attempts) || v.attempts.length > v.max_attempts
    || v.attempts.some(a => !a || !Array.isArray(a.results) || a.results.length !== blanks.length || a.results.some(r => typeof r !== 'boolean'))
    || typeof v.finished !== 'boolean' || typeof v.solved !== 'boolean' || !count(v.streak)
    || (v.answers !== null && (!Array.isArray(v.answers) || v.answers.length !== blanks.length || v.answers.some(a => typeof a !== 'string')))
    || (v.finished && v.answers === null) || (!v.finished && v.answers !== null)) throw Error('Invalid verse state')
  return {
    number: v.number, reference: v.reference, max_attempts: v.max_attempts,
    blanks: blanks.map(b => ({ index: b.index, length: b.length, prev: b.prev })),
    attempts: v.attempts.map(a => ({ results: [...a.results] })), finished: v.finished, solved: v.solved, streak: v.streak,
    answers: v.answers ? [...v.answers] : null,
  }
}

export function createVerseRepository(client: Rpc) {
  async function call(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(12000))
    if (error) throw error
    return data as unknown
  }
  return {
    async today(): Promise<VerseState> { return parseState(await call('verse_today', {})) },
    async guess(words: string[]): Promise<VerseGuessResult> {
      if (!Array.isArray(words) || words.length < 2 || words.length > 3 || words.some(word => typeof word !== 'string' || !word.trim() || word.length > 40)) throw Error('Resposta inválida.')
      const data = await call('verse_guess', { p_words: words.map(word => word.trim()) }) as VerseGuessResult
      const state = parseState(data)
      if (!Array.isArray(data.results) || data.results.length !== state.blanks.length || data.results.some(r => typeof r !== 'boolean')) throw Error('Invalid verse result')
      return { ...state, results: [...data.results] }
    },
  }
}
