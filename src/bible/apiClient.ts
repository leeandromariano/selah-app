import type { Location } from './catalog'
import { parseApiChapter } from './apiChapter'

// This client is intentionally not enabled until the server route has abuse
// controls and the supplier's actual response and FUMS contract are validated.
export async function fetchApiChapter(location: Location, fetcher: typeof fetch = fetch) {
  const params = new URLSearchParams({ translation: location.translation, book: location.book, chapter: String(location.chapter) })
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (import.meta.env.MODE === 'staging') {
    const { supabase } = await import('../lib/supabase')
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session?.access_token) throw Error('Sessão necessária para acessar a Bíblia.')
    headers.Authorization = `Bearer ${data.session.access_token}`
  }
  const response = await fetcher(`/api/bible?${params}`, { credentials: 'same-origin', headers })
  if (!response.ok) throw Error('Não foi possível carregar o capítulo.')
  return parseApiChapter(await response.json())
}
