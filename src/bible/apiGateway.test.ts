import { describe, expect, it, vi } from 'vitest'
import { bibleGateway } from './apiGateway'

const request = (query: string) => new Request(`https://example.test/api/bible?${query}`)

describe('bible API gateway', () => {
  it('uses only the allowed translation and book and keeps the key upstream', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: { content: [] }, meta: {} }))
    const result = await bibleGateway(request('translation=nvt&book=joao&chapter=3'), { apiKey: 'fictional-key', fetcher })
    expect(result.status).toBe(200)
    const [url, options] = fetcher.mock.calls[0] as [URL, RequestInit]
    expect(url.origin).toBe('https://rest.api.bible')
    expect(url.pathname).toBe('/v1/bibles/41a6caa722a21d88-01/chapters/JHN.3')
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

  it('reports the provider status without forwarding its error body or the key', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('private provider detail', { status: 403 }))
    const result = await bibleGateway(request('translation=ntlh&book=esdras&chapter=1'), { apiKey: 'fictional-key', fetcher })
    expect(result.status).toBe(502)
    expect(await result.json()).toEqual({ error: 'Não foi possível carregar o capítulo.', providerStatus: 403 })
  })
})
