import type { SupabaseClient } from '@supabase/supabase-js'

export type ReadingStatus = 'paused' | 'active' | 'elsewhere' | 'ready' | 'completed' | 'unavailable' | 'revision_changed' | 'out_of_order' | 'gap' | 'too_early'
export type ReadingState = {
  status: ReadingStatus; devotional_id: string; revision?: number; credited_ms: number;
  revision_changed: boolean; token?: string | null; sequence?: number | null;
  completed_at?: string | null; completed_day?: string | null;
}
export type Completion = { source_devotional_id: string; devotional_id: string | null; completed_at: string; completed_day: string }
const statuses: ReadingStatus[] = ['paused', 'active', 'elsewhere', 'ready', 'completed', 'unavailable', 'revision_changed', 'out_of_order', 'gap', 'too_early']
function parseState(data: unknown): ReadingState {
  const value = data as ReadingState | null
  if (!value || !statuses.includes(value.status) || typeof value.devotional_id !== 'string' || !Number.isInteger(value.credited_ms) || value.credited_ms < 0 || value.credited_ms > 60000
    || (value.status !== 'unavailable' && (!Number.isSafeInteger(value.revision) || value.revision! < 1))
    || (['ready', 'completed'].includes(value.status) && value.credited_ms !== 60000)
    || (['active', 'gap', 'out_of_order'].includes(value.status) && (typeof value.token !== 'string' || !Number.isSafeInteger(value.sequence)))
    || (value.status === 'completed' && (!value.completed_at || !Number.isFinite(Date.parse(value.completed_at)) || !/^\d{4}-\d{2}-\d{2}$/.test(value.completed_day ?? '')))) throw new Error('Invalid reading response')
  return value
}
export function readingMessage(error: unknown) {
  return ['42501', 'PGRST301', 'PGRST303'].includes((error as { code?: string })?.code ?? '')
    ? 'Sua sessão não autoriza esta operação. Entre novamente para continuar.'
    : 'Sem conexão ou serviço indisponível. O tempo ainda não confirmado não será contado. Tente novamente.'
}
export function createReadingRepository(client: Pick<SupabaseClient, 'rpc' | 'from'>) {
  async function call(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(12000))
    if (error) throw error
    const state = parseState(data)
    if (state.devotional_id !== args.p_devotional_id) throw new Error('Unexpected reading identity')
    return state
  }
  return {
    state: (id: string) => call('get_my_reading_state', { p_devotional_id: id }),
    start: (id: string, clientId: string, revision: number, transfer = false) => call(transfer ? 'take_over_reading' : 'start_reading', { p_devotional_id: id, p_client_id: clientId, p_revision: revision }),
    checkpoint: (id: string, clientId: string, token: string, sequence: number) => call('checkpoint_reading', { p_devotional_id: id, p_client_id: clientId, p_token: token, p_sequence: sequence }),
    pause: (id: string, clientId: string, token: string) => call('pause_reading', { p_devotional_id: id, p_client_id: clientId, p_token: token }),
    complete: (id: string) => call('complete_devotional', { p_devotional_id: id }),
    async completions(userId: string) {
      const result: Completion[] = []
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await client.from('devotional_completions').select('source_devotional_id,devotional_id,completed_at,completed_day').eq('user_id', userId).order('completed_at', { ascending: false }).order('source_devotional_id', { ascending: false }).range(offset, offset + 99)
        if (error) throw error
        if (!Array.isArray(data)) throw new Error('Invalid completions response')
        result.push(...data as Completion[])
        if (data.length < 100) return result
      }
    },
  }
}
export type ReadingRepository = ReturnType<typeof createReadingRepository>
