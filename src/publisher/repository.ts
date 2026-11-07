import type { SupabaseClient } from '@supabase/supabase-js'
import { EditorialValidationError, adminColumns, editorialFields } from '../admin/repository'
import type { AdminDevotional, DevotionalInput } from '../admin/repository'

export type PublisherDevotional = AdminDevotional

export function publisherMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  if (code === '42501' || code === 'PGRST116') return 'Acesso negado ou texto não está disponível para edição. Confira sua permissão e o estado da revisão.'
  if (code === '23514' || code === '23502') return 'Confira os campos e o nome do autor.'
  if (error instanceof EditorialValidationError) return error.message
  return 'Não foi possível concluir. Verifique sua conexão e tente novamente.'
}

export function createPublisherRepository(client: Pick<SupabaseClient, 'from' | 'rpc'>) {
  async function authorize() {
    const { data, error } = await client.rpc('get_my_publisher_access')
    if (error) throw error
    if (data !== true) throw { code: '42501' }
  }
  return {
    async list(userId: string): Promise<PublisherDevotional[]> {
      await authorize()
      const rows: PublisherDevotional[] = []
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await client.from('devotionals')
          .select<typeof adminColumns, PublisherDevotional>(adminColumns)
          .eq('author_id', userId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + 99)
        if (error) throw error
        rows.push(...data as PublisherDevotional[])
        if (data.length < 100) return rows
      }
    },
    async saveDraft(userId: string, input: DevotionalInput, id?: string): Promise<PublisherDevotional> {
      const fields = editorialFields({ ...input, status: 'draft', publish_at: null })
      await authorize()
      const query = id
        ? client.from('devotionals').update(fields).eq('id', id).eq('author_id', userId)
        : client.from('devotionals').insert({ ...fields, author_id: userId })
      const { data, error } = await query.select<typeof adminColumns, PublisherDevotional>(adminColumns).single()
      if (error) throw error
      if (!data || (id && data.id !== id)) throw { code: 'PGRST116' }
      return data as PublisherDevotional
    },
    async submitForReview(id: string): Promise<void> {
      await authorize()
      const { error } = await client.rpc('submit_devotional_for_review', { p_id: id })
      if (error) throw error
    },
  }
}
