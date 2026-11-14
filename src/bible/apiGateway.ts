// Server-side gateway. The API key is supplied by the hosting environment only.
const editions: Record<string, string> = {
  nvt: '41a6caa722a21d88-01',
  ara: 'afc24de218ef6e38-01',
  ntlh: 'acef2bc597c450a1-01',
}

import { apiBookIds, books } from './catalog.ts'

type GatewayOptions = { apiKey?: string; fetcher?: typeof fetch }
const json = (data: unknown, status: number) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })

export async function bibleGateway(request: Request, { apiKey, fetcher = fetch }: GatewayOptions): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405)
  const url = new URL(request.url)
  const translation = url.searchParams.get('translation') ?? ''
  const search = url.searchParams.get('search')
  if (search !== null) {
    const query = search.trim()
    if (!Object.hasOwn(editions, translation) || query.length < 2 || query.length > 80 || [...query].some(char => { const code = char.charCodeAt(0); return code < 32 || code === 127 })) return json({ error: 'Busca inválida.' }, 400)
    if (!apiKey) return json({ error: 'Bíblia indisponível.' }, 503)
    const endpoint = new URL(`https://rest.api.bible/v1/bibles/${editions[translation]}/search`)
    endpoint.search = new URLSearchParams({ query, limit: '10', sort: 'relevance' }).toString()
    try {
      const response = await fetcher(endpoint, { headers: { 'api-key': apiKey, Accept: 'application/json' }, redirect: 'manual' })
      if (!response.ok) return json({ error: 'Não foi possível buscar na Bíblia.' }, 502)
      const payload: unknown = await response.json()
      const data = (payload as { data?: { verses?: unknown } })?.data
      if (!Array.isArray(data?.verses)) return json({ error: 'Resposta de busca inválida.' }, 502)
      // Return references only. The chapter reader supplies licensed text and view tracking.
      const results = data.verses.slice(0, 10).flatMap(value => {
        const verse = value as { id?: unknown }
        const match = typeof verse.id === 'string' ? /^([A-Z0-9]{3})\.([1-9]\d{0,2})\.([1-9]\d{0,2})$/.exec(verse.id) : null
        const index = match ? apiBookIds.indexOf(match[1]) : -1
        if (index < 0 || Number(match![2]) > books[index].chapters) return []
        return [{ book: books[index].id, chapter: Number(match![2]), verse: Number(match![3]), reference: `${books[index].name} ${match![2]}:${match![3]}` }]
      })
      return json({ results }, 200)
    } catch { return json({ error: 'Não foi possível buscar na Bíblia.' }, 502) }
  }
  const book = url.searchParams.get('book') ?? ''
  const chapterValue = url.searchParams.get('chapter') ?? ''
  const index = books.findIndex(item => item.id === book)
  const chapter = Number(chapterValue)
  if (!Object.hasOwn(editions, translation) || index < 0 || !/^[1-9]\d{0,2}$/.test(chapterValue) || chapter > books[index].chapters) return json({ error: 'Referência inválida.' }, 400)
  if (!apiKey) return json({ error: 'Bíblia indisponível.' }, 503)
  const endpoint = new URL(`https://rest.api.bible/v1/bibles/${editions[translation]}/chapters/${apiBookIds[index]}.${chapter}`)
  endpoint.search = new URLSearchParams({ 'content-type': 'json', 'include-notes': 'false', 'include-titles': 'false', 'include-verse-numbers': 'true', 'fums-version': '3' }).toString()
  try {
    const response = await fetcher(endpoint, { headers: { 'api-key': apiKey, Accept: 'application/json' }, redirect: 'manual' })
    if (!response.ok) return json({ error: 'Não foi possível carregar o capítulo.', providerStatus: response.status }, 502)
    const payload: unknown = await response.json()
    // The browser validates the response and only renders safe text nodes.
    return json(payload, 200)
  } catch {
    return json({ error: 'Não foi possível carregar o capítulo.' }, 502)
  }
}
