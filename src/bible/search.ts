import { bookById } from './catalog'

export type BibleSearchResult = { book: string; chapter: number; verse: number; reference: string }

export async function searchBible(translation: string, query: string, fetcher: typeof fetch = fetch): Promise<BibleSearchResult[]> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (import.meta.env.MODE === 'staging') {
    const { supabase } = await import('../lib/supabase')
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session?.access_token) throw Error('Sessão necessária para buscar na Bíblia.')
    headers.Authorization = `Bearer ${data.session.access_token}`
  }
  const params = new URLSearchParams({ translation, search: query })
  const response = await fetcher(`/api/bible?${params}`, { credentials: 'same-origin', headers })
  if (!response.ok) throw Error('Não foi possível buscar na Bíblia.')
  const payload: unknown = await response.json()
  const results = (payload as { results?: unknown })?.results
  if (!Array.isArray(results) || results.length > 10 || results.some(item => !item || typeof item !== 'object' || typeof item.reference !== 'string' || item.reference.length > 160 || typeof item.book !== 'string' || !bookById(item.book) || !Number.isInteger(item.chapter) || item.chapter < 1 || item.chapter > bookById(item.book)!.chapters || !Number.isInteger(item.verse) || item.verse < 1)) throw Error('Resposta de busca inválida.')
  return results as BibleSearchResult[]
}
