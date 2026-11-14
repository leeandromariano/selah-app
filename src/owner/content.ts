import type { SupabaseClient } from '@supabase/supabase-js'
import { parseReference } from '../bible/catalog'

export type ContentGame = 'quiz' | 'who' | 'claims' | 'timeline' | 'verse'
export type Verdict = 'biblia' | 'distorcida' | 'invencao'
export type VerseBlankDraft = { index: number; answer: string; prev: string }
export type ContentItem = {
  id: string; game: ContentGame; prompt: string; reference: string; active: boolean; answers_count: number
  options?: string[]; correct_index?: number
  testament?: 'antigo' | 'novo'; level?: 1 | 2 | 3 | 4; mode?: 'base' | 'profundo'; context?: string
  verdict?: Verdict; explanation?: string
  era?: string; position?: number
  blanks?: VerseBlankDraft[]; seq?: number
}
export type ContentList = { game: ContentGame; total: number; page: number; size: number; items: ContentItem[] }
export type ContentDraft = {
  prompt: string; options: string[]; correct_index: number; reference: string; active: boolean
  testament: 'antigo' | 'novo'; level: 1 | 2 | 3 | 4; mode: 'base' | 'profundo'; context: string
  verdict: Verdict; explanation: string; era: string; position: number; blanks: VerseBlankDraft[]
}
export type ContentSaved = { item: ContentItem; answers_reset: number }

export const contentGames: { id: ContentGame; name: string; promptLabel: string; newLabel: string }[] = [
  { id: 'quiz', name: 'Quiz bíblico', promptLabel: 'Pergunta', newLabel: 'Nova pergunta' },
  { id: 'who', name: 'Quem disse isso?', promptLabel: 'Frase', newLabel: 'Nova frase' },
  { id: 'claims', name: 'Tá na Bíblia ou Tá Amarrado?', promptLabel: 'Frase da carta', newLabel: 'Nova carta' },
  { id: 'timeline', name: 'Linha do Tempo', promptLabel: 'Acontecimento', newLabel: 'Novo acontecimento' },
  { id: 'verse', name: 'Versículo Oculto', promptLabel: 'Versículo', newLabel: 'Novo versículo' },
]
export const levelNames: Record<number, string> = { 1: 'Iniciante', 2: 'Intermediário', 3: 'Avançado', 4: 'Bigode grosso' }
export const verdictNames: Record<Verdict, string> = { biblia: 'Tá na Bíblia', distorcida: 'Tá distorcido', invencao: 'Tá amarrado (invenção)' }
const verdicts: Verdict[] = ['biblia', 'distorcida', 'invencao']
const hasOptions = (game: ContentGame) => game === 'quiz' || game === 'who'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
type Rpc = Pick<SupabaseClient, 'rpc'>

export function emptyDraft(): ContentDraft {
  return { prompt: '', options: ['', '', '', ''], correct_index: 0, reference: '', active: true, testament: 'novo', level: 1, mode: 'base', context: '',
    verdict: 'biblia', explanation: '', era: '', position: 1, blanks: [] }
}
export function draftFromItem(item: ContentItem): ContentDraft {
  return { ...emptyDraft(), prompt: item.game === 'verse' ? '' : item.prompt, options: item.options ? [...item.options] : ['', '', '', ''], correct_index: item.correct_index ?? 0,
    reference: item.reference, active: item.active, testament: item.testament ?? 'novo', level: item.level ?? 1, mode: item.mode ?? 'base', context: item.context ?? '',
    verdict: item.verdict ?? 'biblia', explanation: item.explanation ?? '', era: item.era ?? '', position: item.position ?? 1, blanks: item.blanks ? item.blanks.map(blank => ({ ...blank })) : [] }
}
// Mesmas regras do servidor; o servidor continua sendo a palavra final.
export function validateDraft(game: ContentGame, draft: ContentDraft): string | null {
  const prompt = draft.prompt.trim(), reference = draft.reference.trim(), parsed = parseReference(reference)
  const needsVerse = 'Informe a referência com capítulo e versículo, como “João 3:16” ou “Êxodo 20:1-17”.'
  if (game === 'quiz' && (prompt.length < 5 || prompt.length > 400)) return 'A pergunta precisa ter entre 5 e 400 caracteres.'
  if ((game === 'who' || game === 'claims') && (prompt.length < 5 || prompt.length > 300)) return 'A frase precisa ter entre 5 e 300 caracteres.'
  if (game === 'timeline' && (prompt.length < 5 || prompt.length > 160)) return 'O acontecimento precisa ter entre 5 e 160 caracteres.'
  if (hasOptions(game)) {
    const options = draft.options.map(option => option.trim())
    if (options.length !== 4 || options.some(option => !option || option.length > 120)) return 'Informe exatamente 4 alternativas, com até 120 caracteres cada.'
    if (new Set(options.map(option => option.toLowerCase())).size !== 4) return 'As alternativas precisam ser diferentes entre si.'
    if (!Number.isInteger(draft.correct_index) || draft.correct_index < 0 || draft.correct_index > 3) return 'Escolha qual alternativa é a resposta certa.'
    if (!parsed?.verse) return needsVerse
  }
  if (game === 'who' && (draft.context.trim().length < 10 || draft.context.trim().length > 500)) return 'O contexto precisa ter entre 10 e 500 caracteres.'
  if (game === 'claims') {
    if (!verdicts.includes(draft.verdict)) return 'Escolha o veredito da frase.'
    if (draft.explanation.trim().length < 10 || draft.explanation.trim().length > 600) return 'A explicação precisa ter entre 10 e 600 caracteres.'
    if (reference && !parsed?.verse) return needsVerse
  }
  if (game === 'timeline') {
    if (draft.era.trim().length < 3 || draft.era.trim().length > 60) return 'Informe a era (por exemplo, Patriarcas).'
    if (!parsed?.verse) return needsVerse
    if (!Number.isInteger(draft.position) || draft.position < 1 || draft.position > 999999) return 'Informe a posição na linha do tempo (1 é o mais antigo).'
  }
  if (game === 'verse') {
    if (!parsed?.verse || parsed.endVerse) return 'Informe um único versículo, como “João 3:16”.'
    if (draft.blanks.length < 2 || draft.blanks.length > 3) return 'Escolha 2 ou 3 palavras do versículo para esconder.'
    if (draft.blanks.some(blank => !Number.isInteger(blank.index) || blank.index < 1 || !blank.answer.trim() || blank.answer.length > 40 || blank.prev.length > 40)
      || new Set(draft.blanks.map(blank => blank.index)).size !== draft.blanks.length) return 'As palavras escondidas estão inválidas. Escolha de novo no texto do versículo.'
  }
  return null
}
// Mudanças que tornam antigas as respostas já dadas (o servidor as zera).
export function changesAnswers(game: ContentGame, original: ContentItem | null, draft: ContentDraft) {
  if (!original) return false
  if (hasOptions(game)) return original.correct_index !== draft.correct_index || (original.options ?? []).some((option, i) => option !== draft.options[i].trim())
  if (game === 'claims') return (original.verdict === 'biblia') !== (draft.verdict === 'biblia')
  if (game === 'timeline') return original.position !== draft.position
  const key = (blanks: VerseBlankDraft[]) => [...blanks].sort((a, b) => a.index - b.index).map(blank => `${blank.index}:${blank.answer}`).join('|')
  return original.reference !== draft.reference.trim() || key(original.blanks ?? []) !== key(draft.blanks)
}

function parseItem(value: unknown, game: ContentGame): ContentItem {
  const v = value as ContentItem
  const fail = () => { throw Error('Invalid content item') }
  if (!v || v.game !== game || typeof v.id !== 'string' || !uuid.test(v.id) || typeof v.prompt !== 'string' || typeof v.reference !== 'string' || typeof v.active !== 'boolean' || !count(v.answers_count)) fail()
  const base = { id: v.id, game, prompt: v.prompt, reference: v.reference, active: v.active, answers_count: v.answers_count }
  if (hasOptions(game)) {
    if (!Array.isArray(v.options) || v.options.length !== 4 || v.options.some(option => typeof option !== 'string') || !Number.isInteger(v.correct_index) || v.correct_index! < 0 || v.correct_index! > 3) fail()
    if (game === 'quiz') { if (!['antigo', 'novo'].includes(String(v.testament)) || ![1, 2, 3, 4].includes(Number(v.level))) fail(); return { ...base, options: [...v.options!], correct_index: v.correct_index, testament: v.testament, level: v.level } }
    if (!['base', 'profundo'].includes(String(v.mode)) || typeof v.context !== 'string') fail()
    return { ...base, options: [...v.options!], correct_index: v.correct_index, mode: v.mode, context: v.context }
  }
  if (game === 'claims') { if (!verdicts.includes(v.verdict as Verdict) || typeof v.explanation !== 'string') fail(); return { ...base, verdict: v.verdict, explanation: v.explanation } }
  if (game === 'timeline') { if (typeof v.era !== 'string' || !Number.isInteger(v.position) || v.position! < 1) fail(); return { ...base, era: v.era, position: v.position } }
  if (!Array.isArray(v.blanks) || v.blanks.length < 2 || v.blanks.length > 3 || !Number.isInteger(v.seq)
    || v.blanks.some(blank => !blank || !Number.isInteger(blank.index) || blank.index < 1 || typeof blank.answer !== 'string' || typeof blank.prev !== 'string')) fail()
  return { ...base, seq: v.seq, blanks: v.blanks!.map(blank => ({ index: blank.index, answer: blank.answer, prev: blank.prev })) }
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
      const data: Record<string, unknown> = { prompt: draft.prompt.trim(), reference: draft.reference.trim(), active: draft.active,
        ...(hasOptions(game) ? { options: draft.options.map(option => option.trim()), correct_index: draft.correct_index } : {}),
        ...(game === 'quiz' ? { testament: draft.testament, level: draft.level } : {}),
        ...(game === 'who' ? { mode: draft.mode, context: draft.context.trim() } : {}),
        ...(game === 'claims' ? { verdict: draft.verdict, explanation: draft.explanation.trim() } : {}),
        ...(game === 'timeline' ? { era: draft.era.trim(), position: draft.position } : {}),
        ...(game === 'verse' ? { blanks: draft.blanks.map(blank => ({ index: blank.index, answer: blank.answer.trim(), prev: blank.prev.trim() })) } : {}) }
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
