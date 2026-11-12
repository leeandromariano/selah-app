import type { SupabaseClient } from '@supabase/supabase-js'

export type WhoMode = 'base' | 'profundo'
export type WhoCard = { id: string; mode: WhoMode; quote: string; options: string[] }
export type WhoAnswerResult = { correct: boolean; correct_index: number; context: string; reference: string; counted: boolean }
export type WhoStats = { answered: number; correct: number; total_cards: number }

export const whoModes: { id: WhoMode; name: string; description: string }[] = [
  { id: 'base', name: 'Modo Base', description: 'Histórias e personagens conhecidos.' },
  { id: 'profundo', name: 'Modo Profundo', description: 'Profetas menores, cartas de Paulo, Eclesiastes e mais.' },
]

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
type Rpc = Pick<SupabaseClient, 'rpc'>

export function createWhoRepository(client: Rpc) {
  async function call(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(12000))
    if (error) throw error
    return data as unknown
  }
  return {
    async start(mode: WhoMode, size = 10): Promise<WhoCard[]> {
      if (!whoModes.some(item => item.id === mode) || !Number.isInteger(size) || size < 1 || size > 20) throw Error('Modalidade inválida.')
      const data = await call('who_start', { p_mode: mode, p_count: size })
      if (!Array.isArray(data) || data.length > size) throw Error('Invalid who response')
      // Projeção explícita: nunca guardar campos inesperados (por exemplo, a resposta certa).
      return data.map(item => {
        const card = item as WhoCard
        if (!card || typeof card.id !== 'string' || !uuid.test(card.id) || card.mode !== mode || typeof card.quote !== 'string' || !card.quote.trim()
          || !Array.isArray(card.options) || card.options.length !== 4 || card.options.some(option => typeof option !== 'string')) throw Error('Invalid who card')
        return { id: card.id, mode: card.mode, quote: card.quote, options: [...card.options] }
      })
    },
    async answer(cardId: string, selected: number): Promise<WhoAnswerResult> {
      if (!uuid.test(cardId) || !Number.isInteger(selected) || selected < 0 || selected > 3) throw Error('Resposta inválida.')
      const v = await call('who_answer', { p_card_id: cardId, p_selected: selected }) as WhoAnswerResult
      if (!v || typeof v.correct !== 'boolean' || !Number.isInteger(v.correct_index) || v.correct_index < 0 || v.correct_index > 3
        || typeof v.context !== 'string' || typeof v.reference !== 'string' || typeof v.counted !== 'boolean' || v.correct !== (v.correct_index === selected)) throw Error('Invalid who answer')
      return { correct: v.correct, correct_index: v.correct_index, context: v.context, reference: v.reference, counted: v.counted }
    },
    async stats(): Promise<WhoStats> {
      const v = await call('get_my_who_stats', {}) as WhoStats
      if (!v || !count(v.answered) || !count(v.correct) || !count(v.total_cards) || v.correct > v.answered) throw Error('Invalid who stats')
      return { answered: v.answered, correct: v.correct, total_cards: v.total_cards }
    },
  }
}
