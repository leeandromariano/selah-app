import type { SupabaseClient } from '@supabase/supabase-js'

export type PrivateResponse = { source_devotional_id: string; devotional_id: string | null; body: string; updated_at: string }

export function responseBody(value: string) {
  const body = value.trim()
  if (![...body].length || [...body].length > 500 || [...body].some(char => { const code = char.charCodeAt(0); return (code > 0 && code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127 })) throw new Error('Escreva uma resposta de até 500 caracteres.')
  return body
}

export function createPrivateResponseRepository(client: Pick<SupabaseClient, 'from'>) {
  return {
    async get(userId: string, devotionalId: string): Promise<PrivateResponse | null> {
      const { data, error } = await client.from('devotional_private_responses').select('source_devotional_id,devotional_id,body,updated_at').eq('user_id', userId).eq('source_devotional_id', devotionalId).maybeSingle()
      if (error) throw error
      return data as PrivateResponse | null
    },
    async save(userId: string, devotionalId: string, value: string): Promise<PrivateResponse> {
      const body = responseBody(value)
      const existing = await this.get(userId, devotionalId)
      const query = existing
        ? client.from('devotional_private_responses').update({ body }).eq('user_id', userId).eq('source_devotional_id', devotionalId)
        : client.from('devotional_private_responses').insert({ source_devotional_id: devotionalId, devotional_id: devotionalId, body })
      const { data, error } = await query.select('source_devotional_id,devotional_id,body,updated_at').single()
      if (error) throw error
      return data as PrivateResponse
    },
    async list(userId: string): Promise<PrivateResponse[]> {
      const result: PrivateResponse[] = []
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await client.from('devotional_private_responses').select('source_devotional_id,devotional_id,body,updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).range(offset, offset + 99)
        if (error) throw error
        result.push(...data as PrivateResponse[])
        if (data.length < 100) return result
      }
    },
  }
}
