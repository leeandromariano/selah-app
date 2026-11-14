import type { SupabaseClient } from '@supabase/supabase-js'

export type ClaimVerdict = 'biblia' | 'distorcida' | 'invencao'
export type ClaimCard = { id: string; statement: string }
export type ClaimAnswerResult = { correct: boolean; verdict: ClaimVerdict; explanation: string; reference: string | null; counted: boolean }
export type ClaimStats = { answered: number; correct: number; total_cards: number }

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const verdicts: ClaimVerdict[] = ['biblia', 'distorcida', 'invencao']
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
type Rpc = Pick<SupabaseClient, 'rpc'>

export function createClaimsRepository(client: Rpc) {
  async function call(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(12000))
    if (error) throw error
    return data as unknown
  }
  return {
    async start(size = 5): Promise<ClaimCard[]> {
      if (!Number.isInteger(size) || size < 1 || size > 10) throw Error('Tamanho inválido.')
      const data = await call('claims_start', { p_count: size })
      if (!Array.isArray(data) || data.length > size) throw Error('Invalid claims response')
      // Projeção explícita: nunca guardar campos inesperados (por exemplo, o veredito).
      return data.map(item => {
        const card = item as ClaimCard
        if (!card || typeof card.id !== 'string' || !uuid.test(card.id) || typeof card.statement !== 'string' || !card.statement.trim()) throw Error('Invalid claim card')
        return { id: card.id, statement: card.statement }
      })
    },
    async answer(cardId: string, saidInBible: boolean): Promise<ClaimAnswerResult> {
      if (!uuid.test(cardId) || typeof saidInBible !== 'boolean') throw Error('Resposta inválida.')
      const v = await call('claims_answer', { p_card_id: cardId, p_said_in_bible: saidInBible }) as ClaimAnswerResult
      if (!v || typeof v.correct !== 'boolean' || !verdicts.includes(v.verdict) || typeof v.explanation !== 'string' || !v.explanation.trim()
        || (v.reference !== null && typeof v.reference !== 'string') || typeof v.counted !== 'boolean' || v.correct !== (saidInBible === (v.verdict === 'biblia'))) throw Error('Invalid claim answer')
      return { correct: v.correct, verdict: v.verdict, explanation: v.explanation, reference: v.reference, counted: v.counted }
    },
    async stats(): Promise<ClaimStats> {
      const v = await call('get_my_claims_stats', {}) as ClaimStats
      if (!v || !count(v.answered) || !count(v.correct) || !count(v.total_cards) || v.correct > v.answered) throw Error('Invalid claim stats')
      return { answered: v.answered, correct: v.correct, total_cards: v.total_cards }
    },
  }
}
