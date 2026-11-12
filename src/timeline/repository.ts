import type { SupabaseClient } from '@supabase/supabase-js'

export type TimelineEvent = { id: string; title: string }
export type TimelinePair = { left: TimelineEvent; right: TimelineEvent }
export type TimelineRevealed = TimelineEvent & { era: string; reference: string }
export type TimelineAnswerResult = { correct: boolean; counted: boolean; first: TimelineRevealed; second: TimelineRevealed }
export type TimelineStats = { answered: number; correct: number; total_events: number }

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0
type Rpc = Pick<SupabaseClient, 'rpc'>

function event(value: unknown): TimelineEvent {
  const v = value as TimelineEvent
  if (!v || typeof v.id !== 'string' || !uuid.test(v.id) || !text(v.title)) throw Error('Invalid timeline event')
  return { id: v.id, title: v.title }
}
function revealed(value: unknown): TimelineRevealed {
  const v = value as TimelineRevealed
  if (!text(v?.era) || !text(v?.reference)) throw Error('Invalid timeline answer')
  return { ...event(v), era: v.era, reference: v.reference }
}

export function createTimelineRepository(client: Rpc) {
  async function call(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(12000))
    if (error) throw error
    return data as unknown
  }
  return {
    async start(size = 10): Promise<TimelinePair[]> {
      if (!Number.isInteger(size) || size < 1 || size > 20) throw Error('Tamanho inválido.')
      const data = await call('timeline_start', { p_count: size })
      if (!Array.isArray(data) || data.length > size) throw Error('Invalid timeline response')
      // Projeção explícita: nunca guardar campos inesperados (por exemplo, a posição cronológica).
      return data.map(item => {
        const pair = item as TimelinePair
        const left = event(pair?.left), right = event(pair?.right)
        if (left.id === right.id) throw Error('Invalid timeline pair')
        return { left, right }
      })
    },
    async answer(leftId: string, rightId: string, chosenId: string): Promise<TimelineAnswerResult> {
      if (![leftId, rightId, chosenId].every(id => uuid.test(id)) || leftId === rightId || (chosenId !== leftId && chosenId !== rightId)) throw Error('Resposta inválida.')
      const v = await call('timeline_answer', { p_left: leftId, p_right: rightId, p_chosen: chosenId }) as TimelineAnswerResult
      if (!v || typeof v.correct !== 'boolean' || typeof v.counted !== 'boolean') throw Error('Invalid timeline answer')
      const first = revealed(v.first), second = revealed(v.second)
      const ids = [first.id, second.id].sort(), expected = [leftId, rightId].sort()
      if (ids[0] !== expected[0] || ids[1] !== expected[1] || v.correct !== (chosenId === first.id)) throw Error('Invalid timeline answer')
      return { correct: v.correct, counted: v.counted, first, second }
    },
    async stats(): Promise<TimelineStats> {
      const v = await call('get_my_timeline_stats', {}) as TimelineStats
      if (!v || !count(v.answered) || !count(v.correct) || !count(v.total_events) || v.correct > v.answered) throw Error('Invalid timeline stats')
      return { answered: v.answered, correct: v.correct, total_events: v.total_events }
    },
  }
}
