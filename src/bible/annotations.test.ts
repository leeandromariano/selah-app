import { describe, expect, it, vi } from 'vitest'
import { createBibleAnnotationStore } from './annotations'

const location = { translation: 'nvt', book: 'genesis', chapter: 1 }
const row = { user_id: 'fictional-user', translation: 'nvt', book: 'genesis', chapter: 1, verse_start: 1, verse_end: 1, color: 'yellow' as const, note: 'Nota fictícia' }
function boundary(data: unknown, error: unknown = null) {
  const query = { select: vi.fn(), eq: vi.fn(), upsert: vi.fn(), insert: vi.fn(), delete: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error }), then: (resolve: (v: unknown) => void) => Promise.resolve({ data, error }).then(resolve) }
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.upsert.mockReturnValue(query); query.insert.mockReturnValue(query); query.delete.mockReturnValue(query)
  return { query, client: { from: vi.fn().mockReturnValue(query) } }
}
describe('armazenamento de anotações', () => {
  it('restringe consulta à conta, tradução, livro e capítulo', async () => {
    const { query, client } = boundary([row])
    expect(await createBibleAnnotationStore(client as never).list('fictional-user', location)).toEqual([row])
    expect(query.eq.mock.calls).toEqual([['user_id', 'fictional-user'], ['translation', 'nvt'], ['book', 'genesis'], ['chapter', 1]])
  })
  it('recusa linhas de outra conta e gravação não confirmada', async () => {
    const other = boundary([{ ...row, user_id: 'other-user' }])
    await expect(createBibleAnnotationStore(other.client as never).list('fictional-user', location)).rejects.toThrow()
    const missing = boundary(null)
    await expect(createBibleAnnotationStore(missing.client as never).save(row)).rejects.toThrow()
  })
  it('não envia texto bíblico na anotação', async () => {
    const { query, client } = boundary(row)
    await createBibleAnnotationStore(client as never).save(row)
    expect(query.upsert).toHaveBeenCalledWith(row, expect.objectContaining({ onConflict: expect.stringContaining('user_id') }))
    expect(Object.keys(query.upsert.mock.calls[0][0])).not.toContain('text')
  })
  it('protege favoritos por conta e não copia texto bíblico', async () => {
    const { color: _color, note: _note, ...favorite } = row
    const { query, client } = boundary(favorite)
    await createBibleAnnotationStore(client as never).addFavorite(favorite)
    expect(query.insert).toHaveBeenCalledWith(favorite)
    expect(Object.keys(query.insert.mock.calls[0][0])).not.toContain('text')
    const other = boundary([{ ...favorite, user_id: 'other-user' }])
    await expect(createBibleAnnotationStore(other.client as never).listFavorites('fictional-user', location)).rejects.toThrow()
  })
  it('só confirma remoção de favorito quando o servidor retorna a linha própria', async () => {
    const { color: _color, note: _note, ...favorite } = row
    const { query, client } = boundary({ verse_start: 1 })
    await createBibleAnnotationStore(client as never).removeFavorite(favorite)
    expect(query.eq.mock.calls).toEqual([['user_id', 'fictional-user'], ['translation', 'nvt'], ['book', 'genesis'], ['chapter', 1], ['verse_start', 1], ['verse_end', 1]])
    const missing = boundary(null)
    await expect(createBibleAnnotationStore(missing.client as never).removeFavorite(favorite)).rejects.toThrow()
  })
  it('lista favoritos de todos os capítulos somente para a conta solicitada', async () => {
    const { color: _color, note: _note, ...favorite } = row
    const { query, client } = boundary([favorite])
    expect(await createBibleAnnotationStore(client as never).listAllFavorites('fictional-user')).toEqual([favorite])
    expect(query.eq.mock.calls).toEqual([['user_id', 'fictional-user']])
    const other = boundary([{ ...favorite, user_id: 'other-user' }])
    await expect(createBibleAnnotationStore(other.client as never).listAllFavorites('fictional-user')).rejects.toThrow()
  })
})
