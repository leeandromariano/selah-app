import { describe, expect, it, vi } from 'vitest'
import { createEditorialReaderSource, EditorialUnavailableError, type CatalogTransport } from './catalogRepository'

const id = '20000000-0000-4000-8000-000000000001'
const item = { id, title: 'Fictício', bible_reference: 'Ref', status: 'never-expose', responsible_user_id: 'private' }
function boundary(data: unknown, error: unknown = null) {
  const abortSignal = vi.fn().mockResolvedValue({ data, error })
  const rpc = vi.fn().mockReturnValue({ abortSignal })
  return { transport: { rpc } as CatalogTransport, rpc, abortSignal }
}
describe('adaptação fechada do catálogo editorial candidato', () => {
  it('falha fechada sem transporte e não cria dados', async () => {
    const source = createEditorialReaderSource(null)
    await expect(source.themes(0, new AbortController().signal)).rejects.toBeInstanceOf(EditorialUnavailableError)
  })
  it('usa parâmetros reais, sinal de cancelamento e projeção mínima', async () => {
    const mock = boundary([item]), signal = new AbortController().signal
    const source = createEditorialReaderSource(mock.transport)
    expect(await source.themeDevotionals('esperanca', 2, signal)).toEqual({ items: [{ id, title: 'Fictício', bibleReference: 'Ref' }], nextPage: null })
    expect(mock.rpc).toHaveBeenCalledExactlyOnceWith('reader_editorial_catalog', { p_kind: 'devotionals', p_slug: 'esperanca', p_page: 2, p_size: 25 })
    expect(mock.abortSignal).toHaveBeenCalledExactlyOnceWith(signal)
  })
  it('consulta séries, episódios, detalhes e filtro de série conforme o candidato', async () => {
    const mock = boundary([item]), source = createEditorialReaderSource(mock.transport), signal = new AbortController().signal
    await source.episodes('serie', 0, signal); await source.seriesDevotionals('serie', 1, signal)
    expect(mock.rpc.mock.calls.map(call => call[1].p_kind)).toEqual(['episodes', 'series_devotionals'])
    const detail = boundary({ id, title: 'Série', slug: 'serie', description: null, responsible_user_id: 'private' })
    expect(await createEditorialReaderSource(detail.transport).seriesDetail('serie', signal)).toEqual({ id, title: 'Série', slug: 'serie', description: null })
    expect(detail.rpc.mock.calls[0][1].p_kind).toBe('series_detail')
    const missing = boundary(null)
    expect(await createEditorialReaderSource(missing.transport).seriesDetail('serie', signal)).toBeNull()
  })
  it('trata erros, payload inválido e cancelamento sem revelar detalhes', async () => {
    const signal = new AbortController()
    const broken = boundary(null, { message: 'segredo fictício' })
    await expect(createEditorialReaderSource(broken.transport).themes(0, signal.signal)).rejects.toThrow('Catálogo editorial indisponível.')
    const bad = boundary([{ id: 'wrong', name: 'A', slug: 'a', description: null }])
    await expect(createEditorialReaderSource(bad.transport).themes(0, signal.signal)).rejects.toBeInstanceOf(EditorialUnavailableError)
    signal.abort()
    await expect(createEditorialReaderSource(bad.transport).series(0, signal.signal)).rejects.toBeInstanceOf(EditorialUnavailableError)
    expect(bad.rpc).toHaveBeenCalledTimes(1)
  })
  it('valida limites antes de solicitar e sinaliza possível próxima página sem pular itens', async () => {
    const mock = boundary(Array.from({ length: 25 }, (_, i) => ({ id, name: 'Tema ' + i, slug: 'tema-' + i, description: null })))
    const source = createEditorialReaderSource(mock.transport), signal = new AbortController().signal
    expect((await source.themes(0, signal)).nextPage).toBe(1)
    await expect(source.themes(10001, signal)).rejects.toBeInstanceOf(EditorialUnavailableError)
    await expect(source.episodes('../x', 0, signal)).rejects.toBeInstanceOf(EditorialUnavailableError)
    expect(mock.rpc).toHaveBeenCalledTimes(1)
  })
})
