import type { SupabaseClient } from '@supabase/supabase-js'

export type Completion = { source_devotional_id: string; devotional_id: string | null; completed_at: string; completed_day: string }

export function createReadingRepository(client: Pick<SupabaseClient, 'from'>) {
  return {
    // Conclusões do leitor, em páginas de 100.
    async completions(userId: string) {
      const result: Completion[] = []
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await client.from('devotional_completions').select('source_devotional_id,devotional_id,completed_at,completed_day').eq('user_id', userId).order('completed_at', { ascending: false }).range(offset, offset + 99)
        if (error) throw error
        if (!Array.isArray(data)) throw new Error('Invalid completions response')
        result.push(...data as Completion[])
        if (data.length < 100) return result
      }
    },
  }
}
export type ReadingRepository = ReturnType<typeof createReadingRepository>
