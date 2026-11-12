import type { SupabaseClient } from '@supabase/supabase-js'
import { parseReference } from '../bible/catalog'

export type ContentGame = 'quiz' | 'who'
export type ContentItem = {
  id: string; game: ContentGame; prompt: string; options: string[]; correct_index: number; reference: string; active: boolean; answers_count: number
  testament?: 'antigo' | 'novo'; level?: 1 | 2 | 3 | 4; mode?: 'base' | 'profundo'; context?: string
}
export type ContentList = { game: ContentGame; total: number; page: number; size: number; items: ContentItem[] }
export type ContentDraft = {
  prompt: string; options: string[]; correct_index: number; reference: string; active: boolean
  testament: 'antigo' | 'novo'; level: 1 | 2 | 3 | 4; mode: 'base' | 'profundo'; context: string
}
export type ContentSaved = { item: ContentItem; answers_reset: number }

export const contentGames: { id: ContentGame; name: string; promptLabel: string }[] = [
  { id: 'quiz', name: 'Quiz bíblico', promptLabel: 'Pergunta' },
  { id: 'who', name: 'Quem disse isso?', promptLabel: 'Frase' },
]
export const levelNames: Record<number, string> = { 1: 'Iniciante', 2: 'Intermediário', 3: 'Avançado', 4: 'Bigode grosso' }

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
type Rpc = Pick<SupabaseClient, 'rpc'>

export function emptyDraft(_game: ContentGame): ContentDraft {
  return { prompt: '', options: ['', '', '', ''], correct_index: 0, reference: '', active: true, testament: 'novo', level: 1, mode: 'base', context: '' }
}
export function draftFromItem(item: ContentItem): ContentDraft {
  return { prompt: item.prompt, options: [...item.options], correct_index: item.correct_index, reference: item.reference, active: item.active,
    testament: item.testament ?? 'novo', level: item.level ?? 1, mode: item.mode ?? 'base', context: item.context ?? '' }
}
// Mesmas regras do servidor; o servidor continua sendo a palavra final.
export function validateDraft(game: ContentGame, draft: ContentDraft): string | null {
  const prompt = draft.prompt.trim()
  if (game === 'quiz' ? prompt.length < 5 || prompt.length > 400 : prompt.length < 5 || prompt.length > 300) return game === 'quiz' ? 'A pergunta precisa ter entre 5 e 400 caracteres.' : 'A frase precisa ter entre 5 e 300 caracteres.'
  const options = draft.options.map(option => option.trim())
  if (options.length !== 4 || options.some(option => !option || option.length > 120)) return 'Informe exatamente 4 alternativas, com até 120 caracteres cada.'
  if (new Set(options.map(option => option.toLowerCase())).size !== 4) return 'As alternativas precisam ser diferentes entre si.'
  if (!Number.isInteger(draft.correct_index) || draft.correct_index < 0 || draft.correct_index > 3) return 'Escolha qual alternativa é a resposta certa.'
  const reference = draft.reference.trim()
  const parsed = parseReference(reference)
  if (!parsed?.verse) return 'Informe a referência com capítulo e versículo, como “João 3:16” ou “Êxodo 20:1-17”.'
  if (game === 'who') {
    const context = draft.context.trim()
    if (context.length < 10 || context.length > 500) return 'O contexto precisa ter entre 10 e 500 caracteres.'
  }
  return null
}
export function changesAnswers(original: ContentItem | null, draft: ContentDraft) {
  return Boolean(original && (original.correct_index !== draft.correct_index || original.options.some((option, i) => option !== draft.options[i].trim())))
}

function parseItem(value: unknown, game: ContentGame): ContentItem {
  const v = value as ContentItem
  if (!v || v.game !== game || typeof v.id !== 'string' || !uuid.test(v.id) || typeof v.prompt !== 'string' || !Array.isArray(v.options) || v.options.length !== 4
    || v.options.some(option => typeof option !== 'string') || !Number.isInteger(v.correct_index) || v.correct_index < 0 || v.correct_index > 3
    || typeof v.reference !== 'string' || typeof v.active !== 'boolean' || !count(v.answers_count)
    || (game === 'quiz' && (!['antigo', 'novo'].includes(String(v.testament)) || ![1, 2, 3, 4].includes(Number(v.level))))
    || (game === 'who' && (!['base', 'profundo'].includes(String(v.mode)) || typeof v.context !== 'string'))) throw Error('Invalid content item')
  return { id: v.id, game, prompt: v.prompt, options: [...v.options], correct_index: v.correct_index, reference: v.reference, active: v.active, answers_count: v.answers_count,
    ...(game === 'quiz' ? { testament: v.testament, level: v.level } : { mode: v.mode, context: v.context }) }
}

export function createOwnerContentRepository(client: Rpc) {
  async function call(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(12000))
    if (error) throw error
    return data as unknown
  }
  return {
    async list(game: ContentGame, search = '', filter = '', page = 0, size = 20): Promise<ContentList> {
      const term = search.trim().slice(0, 60)
      if (!contentGames.some(item => item.id === game) || !Number.isInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 50) throw Error('Consulta inválida.')
      const v = await call('owner_content_list', { p_game: game, p_search: term, p_filter: filter, p_page: page, p_size: size }) as ContentList
      if (!v || v.game !== game || !count(v.total) || v.page !== page || v.size !== size || !Array.isArray(v.items) || v.items.length > size) throw Error('Invalid content list')
      return { game, total: v.total, page, size, items: v.items.map(item => parseItem(item, game)) }
    },
    async save(game: ContentGame, id: string | null, draft: ContentDraft): Promise<ContentSaved> {
      const problem = validateDraft(game, draft)
      if (problem) throw Object.assign(Error(problem), { code: '22023' })
      if (id !== null && !uuid.test(id)) throw Error('Identificador inválido.')
      const data: Record<string, unknown> = { prompt: draft.prompt.trim(), options: draft.options.map(option => option.trim()), correct_index: draft.correct_index, reference: draft.reference.trim(), active: draft.active,
        ...(game === 'quiz' ? { testament: draft.testament, level: draft.level } : { mode: draft.mode, context: draft.context.trim() }) }
      const v = await call('owner_content_save', { p_game: game, p_id: id, p_data: data }) as ContentSaved
      if (!v || !count(v.answers_reset)) throw Error('Invalid save response')
      return { item: parseItem(v.item, game), answers_reset: v.answers_reset }
    },
    async remove(game: ContentGame, id: string): Promise<{ answers_removed: number }> {
      if (!uuid.test(id)) throw Error('Identificador inválido.')
      const v = await call('owner_content_delete', { p_game: game, p_id: id }) as { deleted: boolean; answers_removed: number }
      if (!v || v.deleted !== true || !count(v.answers_removed)) throw Error('Invalid delete response')
      return { answers_removed: v.answers_removed }
    },
  }
}
