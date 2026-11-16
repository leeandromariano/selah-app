import type { SupabaseClient } from '@supabase/supabase-js'

// Raio-X do Texto: explicação curta de um termo bíblico, ligada aos versículos onde vale.
export type StudyTerm = {
  id: string; term: string; words: string[]; original: string; context: string; parallel_reference: string
  dictionary?: string | null
  verses: { start: number; end: number }[]
}
export type StudyStatus = 'draft' | 'published'
export type OwnerStudyTerm = Omit<StudyTerm, 'verses'> & { status: StudyStatus; verses: { book: string; chapter: number; start: number; end: number }[] }
export type StudyTermInput = {
  id: string | null; term: string; words: string[]; original: string; context: string; parallel_reference: string
  status: StudyStatus; verses: { book: string; chapter: number; start: number; end: number }[]
  // Dicionário de teologia: nulo/ausente mantém o verbete atual; texto vazio apaga.
  dictionary?: string | null
}

const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0
// Resposta fora do formato descarta o termo em vez de quebrar a leitura: o Raio-X é um extra, nunca o texto.
function parseTerm(value: unknown): StudyTerm | null {
  const v = value as Partial<StudyTerm> | null
  if (!v || !text(v.id) || !text(v.term) || !text(v.original) || !text(v.context) || !text(v.parallel_reference)) return null
  if (!Array.isArray(v.words) || !v.words.every(text) || !Array.isArray(v.verses)) return null
  const verses = v.verses.filter(item => item && Number.isInteger(item.start) && Number.isInteger(item.end))
  return { id: v.id!, term: v.term!, words: v.words, original: v.original!, context: v.context!, parallel_reference: v.parallel_reference!, dictionary: text(v.dictionary) ? v.dictionary!.trim() : null, verses }
}

export function createStudyRepository(client: SupabaseClient) {
  return {
    async chapter(book: string, chapter: number): Promise<StudyTerm[]> {
      const { data, error } = await client.rpc('get_study_terms', { p_book: book, p_chapter: chapter })
      if (error || !Array.isArray(data)) return []
      return data.map(parseTerm).filter((item): item is StudyTerm => item !== null)
    },
    // Capítulos do livro com ao menos um termo publicado, para marcar no seletor. Falha vira lista vazia: é só um aviso.
    async bookChapters(book: string): Promise<number[]> {
      const { data, error } = await client.rpc('get_study_chapters', { p_book: book })
      if (error || !Array.isArray(data)) return []
      return data.filter((item): item is number => Number.isInteger(item) && item > 0)
    },
    async ownerList(): Promise<OwnerStudyTerm[]> {
      const { data, error } = await client.rpc('owner_list_study_terms')
      if (error || !Array.isArray(data)) throw Error('Não foi possível carregar os termos.')
      return data as OwnerStudyTerm[]
    },
    async ownerSave(input: StudyTermInput): Promise<void> {
      const { error } = await client.rpc('owner_save_study_term', {
        p_id: input.id, p_term: input.term, p_words: input.words, p_original: input.original, p_context: input.context,
        p_parallel: input.parallel_reference, p_status: input.status, p_verses: input.verses, p_dictionary: input.dictionary ?? null,
      })
      if (error) throw Error('Não foi possível salvar o termo.')
    },
    // Preenche verbetes do dicionário pelo nome do termo, sem mexer no resto. Devolve quantos foram gravados e os nomes sem cadastro.
    async ownerSetDictionary(entries: { term: string; dictionary: string }[]): Promise<{ updated: number; missing: string[] }> {
      const { data, error } = await client.rpc('owner_set_study_dictionary', { p_entries: entries })
      const result = data as { updated?: unknown; missing?: unknown } | null
      if (error || !result || typeof result.updated !== 'number') throw Error('Não foi possível salvar o dicionário.')
      return { updated: result.updated, missing: Array.isArray(result.missing) ? result.missing.filter((item): item is string => typeof item === 'string') : [] }
    },
    async ownerDelete(id: string): Promise<void> {
      const { error } = await client.rpc('owner_delete_study_term', { p_id: id })
      if (error) throw Error('Não foi possível excluir o termo.')
    },
  }
}
