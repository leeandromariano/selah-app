import type { SupabaseClient } from '@supabase/supabase-js'

export type Publication = { id: string; title: string; bible_reference: string; bible_text: string; content: string; reflection_question: string; publish_at: string; reading_revision: number }
export type Opening = { id: string; devotional_id: string | null; opened_at: string }
export const publicationColumns = 'id,title,bible_reference,bible_text,content,reflection_question,publish_at,reading_revision'
export const readingTimeZone = 'America/Sao_Paulo'
export function localDay(instant: string | Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: readingTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant))
  const part = (type: string) => parts.find(value => value.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function publishedToday(items: Publication[], now: Date) {
  return items.filter(item => new Date(item.publish_at) <= now && localDay(item.publish_at) === localDay(now)).sort((a, b) => Date.parse(b.publish_at) - Date.parse(a.publish_at) || b.id.localeCompare(a.id))[0] ?? null
}
export function displayDate(instant: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: readingTimeZone, dateStyle: 'medium' }).format(new Date(instant))
}
export function toCard(item: Publication) {
  return { id: item.id, title: item.title, reference: item.bible_reference, verse: item.bible_text, summary: item.content.length > 150 ? item.content.slice(0, 150) + '…' : item.content, reflection: item.content, question: item.reflection_question, theme: 'Devocional', date: displayDate(item.publish_at), minutes: Math.max(1, Math.ceil((item.bible_text + ' ' + item.content).trim().split(/\s+/).length / 200)), color: 'lavender' }
}
export function devotionalMessage(error: unknown) {
  const code = (error as { code?: string })?.code
  return ['42501', 'PGRST301', 'PGRST303'].includes(code ?? '') ? 'Você não tem autorização. Entre novamente para continuar.' : 'Não foi possível carregar ou salvar os dados. Verifique sua conexão e tente novamente.'
}
// Read all pages explicitly: PostgREST caps a single response.
async function pages<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const result: T[] = []
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await query(offset, offset + 99)
    if (error) throw error
    const batch = data as T[]
    result.push(...batch)
    if (batch.length < 100) return result
  }
}
export function createDevotionalRepository(client: Pick<SupabaseClient, 'from'>) {
  return {
    published(now: Date) {
      return pages<Publication>((from, to) => client.from('devotionals').select(publicationColumns).eq('status', 'published').lte('publish_at', now.toISOString()).order('publish_at', { ascending: false }).order('id', { ascending: false }).range(from, to))
    },
    openings(userId: string) {
      return pages<Opening>((from, to) => client.from('devotional_views').select('id,devotional_id,opened_at').eq('user_id', userId).order('opened_at', { ascending: false }).order('id', { ascending: false }).range(from, to))
    },
    async lastOpening(userId: string): Promise<Opening | null> {
      const { data, error } = await client.from('devotional_views').select('id,devotional_id,opened_at').eq('user_id', userId).order('opened_at', { ascending: false }).order('id', { ascending: false }).range(0, 0)
      if (error) throw error
      if (!Array.isArray(data) || data.length > 1) throw new Error('Invalid opening response')
      const opening = data[0] as Opening | undefined
      if (opening && (typeof opening.id !== 'string' || (opening.devotional_id !== null && typeof opening.devotional_id !== 'string') || typeof opening.opened_at !== 'string' || !Number.isFinite(Date.parse(opening.opened_at)))) throw new Error('Invalid opening response')
      return opening ?? null
    },
    async availableTitle(id: string, now: Date): Promise<{ id: string; title: string } | null> {
      const { data, error } = await client.from('devotionals').select('id,title').eq('id', id).eq('status', 'published').lte('publish_at', now.toISOString()).range(0, 0)
      if (error) throw error
      if (!Array.isArray(data) || data.length > 1) throw new Error('Invalid publication response')
      const item = data[0] as { id: string; title: string } | undefined
      if (item && (item.id !== id || typeof item.title !== 'string' || !item.title.trim())) throw new Error('Invalid publication response')
      return item ?? null
    },
    async open(devotionalId: string): Promise<Opening> {
      const { data, error } = await client.from('devotional_views').insert({ devotional_id: devotionalId }).select('id,devotional_id,opened_at').single()
      if (error) throw error
      if (!data) throw new Error('Missing recorded opening')
      return data as Opening
    },
  }
}
