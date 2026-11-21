import type { SupabaseClient } from '@supabase/supabase-js'
import type { Location } from '../bible/catalog'
import { bibleEditorialEnabled } from '../bible/editorialFeature.ts'
import { guidedDevotionalsEnabled } from '../devotionals/guidedFeature.ts'

export type DevotionalStatus = 'draft' | 'scheduled' | 'published'
export type BibleSelectionRecord = Location & { verse: number; endVerse: number }
export type DevotionalInput = { author_name: string | null; title: string; share_phrase?: string | null; bible_reference: string; bible_text: string | null; bible_selection?: BibleSelectionRecord | null; content: string; reflection_question: string; practical_challenge?: string | null; prayer_prompt?: string | null; publish_at: string | null; status: DevotionalStatus }
export type AdminDevotional = DevotionalInput & { review_requested_at: string | null; id: string; author_id: string; created_at: string; updated_at: string }
export const adminColumns = `id,author_name,review_requested_at,title,share_phrase,bible_reference,bible_text,${bibleEditorialEnabled ? 'bible_selection,' : ''}content,reflection_question,${guidedDevotionalsEnabled ? 'practical_challenge,prayer_prompt,' : ''}publish_at,status,author_id,created_at,updated_at`
export const statusLabels = { draft: 'Rascunho', scheduled: 'Agendado', published: 'Publicado' }

export class EditorialValidationError extends Error {}
export function editorialFields(input: DevotionalInput, now = new Date(), requireGuided = false): DevotionalInput {
  const author_name = (input.author_name ?? '').trim()
  if ([...author_name].length < 2 || [...author_name].length > 120) throw new EditorialValidationError('Informe o nome do autor (2 a 120 caracteres).')
  const title = input.title.trim()
  const share_phrase = input.share_phrase?.trim() || null
  const bible_reference = input.bible_reference.trim()
  const bible_text = input.bible_text?.trim() ?? null
  const bible_selection = input.bible_selection ?? null
  const content = input.content.trim()
  const reflection_question = input.reflection_question.trim()
  const practical_challenge = input.practical_challenge?.trim() || null
  const prayer_prompt = input.prayer_prompt?.trim() || null
  if (guidedDevotionalsEnabled && ((requireGuided && (!practical_challenge || !prayer_prompt)) || Boolean(practical_challenge) !== Boolean(prayer_prompt) || (practical_challenge && [...practical_challenge].length > 500) || (prayer_prompt && [...prayer_prompt].length > 500))) throw new EditorialValidationError('Preencha prática e oração, com até 500 caracteres cada.')
  if (!title || [...title].length > 200) throw new EditorialValidationError('Informe um título de até 200 caracteres.')
  if (share_phrase && ([...share_phrase].length > 180 || [...share_phrase].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))) throw new EditorialValidationError('A frase central deve ter até 180 caracteres e estar em uma linha.')
  if (!bible_reference || [...bible_reference].length > 200) throw new EditorialValidationError('Informe uma referência bíblica de até 200 caracteres.')
  if ((!bible_text && !bible_selection) || (bible_text && bible_selection) || !content || !reflection_question) throw new EditorialValidationError('Preencha texto bíblico, reflexão e pergunta para refletir.')
  if (!['draft', 'scheduled', 'published'].includes(input.status)) throw new EditorialValidationError('Selecione uma situação válida.')
  const instant = input.publish_at ? new Date(input.publish_at) : null
  if (input.publish_at && Number.isNaN(instant!.getTime())) throw new EditorialValidationError('Informe uma data e hora válidas.')
  if (input.status !== 'draft' && !instant) throw new EditorialValidationError('Informe a data e hora de publicação.')
  if (input.status === 'scheduled' && instant! <= now) throw new EditorialValidationError('Escolha uma data futura para agendar.')
  if (input.status === 'published' && instant! > now) throw new EditorialValidationError('Para uma data futura, use Agendado.')
  return { author_name, title, ...(input.share_phrase !== undefined ? { share_phrase } : {}), bible_reference, bible_text, ...(input.bible_selection !== undefined ? { bible_selection } : {}), content, reflection_question, ...(guidedDevotionalsEnabled ? { practical_challenge, prayer_prompt } : {}), status: input.status, publish_at: instant?.toISOString() ?? null }
}
export function adminMessage(error: unknown) {
  if (error instanceof EditorialValidationError) return error.message
  const code = (error as { code?: string })?.code
  if (['42501', 'PGRST301', 'PGRST303', 'PGRST116'].includes(code ?? '')) return 'Acesso administrativo negado ou conteúdo indisponível. Entre novamente e confira suas permissões.'
  if (code === '23514' || code === '23502') return 'Confira os campos obrigatórios e a data de publicação.'
  return 'Não foi possível concluir. Verifique sua conexão e tente novamente.'
}
export function dateTimeInput(instant: string | null) {
  if (!instant) return ''
  const date = new Date(instant)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export function publicationInstant(value: string, original: string | null) {
  if (!value) return null
  if (original && value === dateTimeInput(original)) return original
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || dateTimeInput(date.toISOString()) !== value) throw new EditorialValidationError('Informe uma data e hora válidas no fuso do dispositivo.')
  return date.toISOString()
}
export function createAdminRepository(client: Pick<SupabaseClient, 'from' | 'rpc'>) {
  async function authorize() {
    // Verify current private membership; never display the returned readership counts.
    const { error } = await client.rpc('devotional_open_counts')
    if (error) throw error
  }
  return {
    async list(): Promise<AdminDevotional[]> {
      await authorize()
      const rows: AdminDevotional[] = []
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await client.from('devotionals').select<typeof adminColumns, AdminDevotional>(adminColumns).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 99)
        if (error) throw error
        rows.push(...data as AdminDevotional[])
        if (data.length < 100) return rows
      }
    },
    async returnToAuthor(id: string): Promise<void> {
      await authorize()
      const { error } = await client.rpc('return_devotional_to_author', { p_id: id })
      if (error) throw error
    },
    async save(userId: string, input: DevotionalInput, id?: string): Promise<AdminDevotional> {
      const fields = editorialFields(input, new Date(), guidedDevotionalsEnabled && !id)
      await authorize()
      const query = id ? client.from('devotionals').update(fields).eq('id', id) : client.from('devotionals').insert({ ...fields, author_id: userId })
      const { data, error } = await query.select<typeof adminColumns, AdminDevotional>(adminColumns).single()
      if (error) throw error
      if (!data || (id && data.id !== id)) throw { code: 'PGRST116' }
      return data as AdminDevotional
    },
  }
}
