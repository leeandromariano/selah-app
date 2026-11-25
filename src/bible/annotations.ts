import type { SupabaseClient } from '@supabase/supabase-js'
import type { Location } from './catalog'

export type AnnotationColor = 'yellow' | 'blue' | 'pink'
export type BibleAnnotation = { user_id: string; translation: string; book: string; chapter: number; verse_start: number; verse_end: number; color: AnnotationColor | null; note: string }
export type BibleFavorite = Pick<BibleAnnotation, 'user_id' | 'translation' | 'book' | 'chapter' | 'verse_start' | 'verse_end'>
const columns = 'user_id,translation,book,chapter,verse_start,verse_end,color,note'
const key = 'user_id,translation,book,chapter,verse_start,verse_end'
export type AnnotationStore = ReturnType<typeof createBibleAnnotationStore>

export function createBibleAnnotationStore(client: Pick<SupabaseClient, 'from'>) {
  return {
    async list(userId: string, location: Location): Promise<BibleAnnotation[]> {
      const { data, error } = await client.from('bible_personal_annotations').select(columns)
        .eq('user_id', userId).eq('translation', location.translation).eq('book', location.book).eq('chapter', location.chapter)
      if (error) throw error
      if (!Array.isArray(data) || data.some(row => row.user_id !== userId || row.translation !== location.translation || row.book !== location.book || row.chapter !== location.chapter)) throw Error('Resposta inválida')
      return data as BibleAnnotation[]
    },
    async save(record: BibleAnnotation): Promise<void> {
      if (!record.user_id || !['nvt', 'ara', 'ntlh'].includes(record.translation) || !['yellow', 'blue', 'pink', null].includes(record.color) || record.note.length > 3000 || (!record.color && !record.note.trim())) throw Error('Anotação inválida')
      const { data, error } = await client.from('bible_personal_annotations').upsert(record, { onConflict: key }).select(columns).maybeSingle()
      if (error) throw error
      if (!data || data.user_id !== record.user_id || data.translation !== record.translation || data.book !== record.book || data.chapter !== record.chapter || data.verse_start !== record.verse_start || data.verse_end !== record.verse_end) throw Error('Anotação não confirmada')
    },
    async remove(record: Pick<BibleAnnotation, 'user_id' | 'translation' | 'book' | 'chapter' | 'verse_start' | 'verse_end'>): Promise<void> {
      const { data, error } = await client.from('bible_personal_annotations').delete().eq('user_id', record.user_id).eq('translation', record.translation).eq('book', record.book).eq('chapter', record.chapter).eq('verse_start', record.verse_start).eq('verse_end', record.verse_end).select('verse_start').maybeSingle()
      if (error) throw error
      if (!data || data.verse_start !== record.verse_start) throw Error('Remoção não confirmada')
    },
    async listFavorites(userId: string, location: Location): Promise<BibleFavorite[]> {
      const { data, error } = await client.from('bible_favorite_verses').select(key)
        .eq('user_id', userId).eq('translation', location.translation).eq('book', location.book).eq('chapter', location.chapter)
      if (error) throw error
      if (!Array.isArray(data) || data.some(row => row.user_id !== userId || row.translation !== location.translation || row.book !== location.book || row.chapter !== location.chapter)) throw Error('Resposta inválida')
      return data as BibleFavorite[]
    },
    async listAllFavorites(userId: string): Promise<BibleFavorite[]> {
      const { data, error } = await client.from('bible_favorite_verses').select(key).eq('user_id', userId)
      if (error) throw error
      if (!Array.isArray(data) || data.some(row => row.user_id !== userId)) throw Error('Resposta inválida')
      return data as BibleFavorite[]
    },
    async addFavorite(record: BibleFavorite): Promise<void> {
      const { data, error } = await client.from('bible_favorite_verses').insert(record).select(key).maybeSingle()
      if (error) throw error
      if (!data || data.user_id !== record.user_id || data.translation !== record.translation || data.book !== record.book || data.chapter !== record.chapter || data.verse_start !== record.verse_start || data.verse_end !== record.verse_end) throw Error('Favorito não confirmado')
    },
    async removeFavorite(record: BibleFavorite): Promise<void> {
      const { data, error } = await client.from('bible_favorite_verses').delete().eq('user_id', record.user_id).eq('translation', record.translation).eq('book', record.book).eq('chapter', record.chapter).eq('verse_start', record.verse_start).eq('verse_end', record.verse_end).select('verse_start').maybeSingle()
      if (error) throw error
      if (!data || data.verse_start !== record.verse_start) throw Error('Remoção não confirmada')
    },
  }
}
