// Server-side gateway. The API key is supplied by the hosting environment only.
const editions: Record<string, string> = {
  nvt: '41a6caa722a21d88-01',
  ara: 'afc24de218ef6e38-01',
  ntlh: 'acef2bc597c450a1-01',
}

import { books } from './catalog.ts'

const apiBookIds = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ')

type GatewayOptions = { apiKey?: string; fetcher?: typeof fetch }
const json = (data: unknown, status: number) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })

export async function bibleGateway(request: Request, { apiKey, fetcher = fetch }: GatewayOptions): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405)
  const url = new URL(request.url)
  const translation = url.searchParams.get('translation') ?? ''
  const book = url.searchParams.get('book') ?? ''
  const chapterValue = url.searchParams.get('chapter') ?? ''
  const index = books.findIndex(item => item.id === book)
  const chapter = Number(chapterValue)
  if (!Object.hasOwn(editions, translation) || index < 0 || !/^[1-9]\d{0,2}$/.test(chapterValue) || chapter > books[index].chapters) return json({ error: 'Referência inválida.' }, 400)
  if (!apiKey) return json({ error: 'Bíblia indisponível.' }, 503)
  const endpoint = new URL(`https://rest.api.bible/v1/bibles/${editions[translation]}/chapters/${apiBookIds[index]}.${chapter}`)
  endpoint.search = new URLSearchParams({ 'content-type': 'json', 'include-notes': 'false', 'include-titles': 'false', 'include-verse-numbers': 'true', 'fums-version': '3' }).toString()
  try {
    const response = await fetcher(endpoint, { headers: { 'api-key': apiKey, Accept: 'application/json' }, redirect: 'error' })
    if (!response.ok) return json({ error: 'Não foi possível carregar o capítulo.', providerStatus: response.status }, 502)
    const payload: unknown = await response.json()
    // The browser validates the response and only renders safe text nodes.
    return json(payload, 200)
  } catch {
    return json({ error: 'Não foi possível carregar o capítulo.' }, 502)
  }
}
