import { describe, expect, it, vi } from 'vitest'
import { bibleGateway } from './apiGateway'

const request = (query: string) => new Request(`https://example.test/api/bible?${query}`)

describe('bible API gateway', () => {
  it('searches approved editions and returns only navigable references', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: { verses: [{ id: 'JHN.3.16', text: 'licensed text', reference: 'John 3:16' }, { id: 'BAD.1.1', text: 'other' }] } }))
    const result = await bibleGateway(request('translation=nvt&search=ansiedade'), { apiKey: 'fictional-key', fetcher })
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ results: [{ book: 'joao', chapter: 3, verse: 16, reference: 'João 3:16' }] })
    const [url] = fetcher.mock.calls[0] as [URL]
    expect(url.pathname).toBe('/v1/bibles/41a6caa722a21d88-01/search')
    expect(url.searchParams.get('query')).toBe('ansiedade')
    expect(url.searchParams.get('limit')).toBe('10')
  })
  it('rejects malformed search before any upstream call', async () => {
    const fetcher = vi.fn()
    for (const query of ['translation=nvi&search=ansiedade', 'translation=nvt&search=x', `translation=nvt&search=${'a'.repeat(81)}`]) expect((await bibleGateway(request(query), { apiKey: 'fictional-key', fetcher })).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('uses only the allowed translation and book and keeps the key upstream', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: { content: [] }, meta: {} }))
    const result = await bibleGateway(request('translation=nvt&book=joao&chapter=3'), { apiKey: 'fictional-key', fetcher })
    expect(result.status).toBe(200)
    const [url, options] = fetcher.mock.calls[0] as [URL, RequestInit]
    expect(url.origin).toBe('https://rest.api.bible')
    expect(url.pathname).toBe('/v1/bibles/41a6caa722a21d88-01/chapters/JHN.3')
    expect(options.redirect).toBe('manual')
    expect(options.headers).toEqual({ 'api-key': 'fictional-key', Accept: 'application/json' })
    expect(await result.text()).not.toContain('fictional-key')
  })

  it('rejects invalid references before contacting the provider', async () => {
    const fetcher = vi.fn()
    for (const query of ['translation=other&book=joao&chapter=3', 'translation=ara&book=joao&chapter=22', 'translation=ntlh&book=../x&chapter=1', 'translation=ara&book=joao&chapter=01']) {
      expect((await bibleGateway(request(query), { apiKey: 'fictional-key', fetcher })).status).toBe(400)
    }
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('fails closed when unconfigured or when upstream fails', async () => {
    expect((await bibleGateway(request('translation=ara&book=genesis&chapter=1'), {})).status).toBe(503)
    const fetcher = vi.fn().mockRejectedValue(Error('private upstream error'))
    const result = await bibleGateway(request('translation=ntlh&book=genesis&chapter=1'), { apiKey: 'fictional-key', fetcher })
    expect(result.status).toBe(502)
    expect(await result.text()).not.toMatch(/fictional-key|private upstream error/)
  })

  it('does not follow provider redirects with the API key', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { Location: 'https://other.invalid/' } }))
    const result = await bibleGateway(request('translation=nvt&book=genesis&chapter=1'), { apiKey: 'fictional-key', fetcher })
    expect(result.status).toBe(502)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[0][1].redirect).toBe('manual')
  })

  it('reports the provider status without forwarding its error body or the key', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('private provider detail', { status: 403 }))
    const result = await bibleGateway(request('translation=ntlh&book=esdras&chapter=1'), { apiKey: 'fictional-key', fetcher })
    expect(result.status).toBe(502)
    expect(await result.json()).toEqual({ error: 'Não foi possível carregar o capítulo.', providerStatus: 403 })
  })
})
