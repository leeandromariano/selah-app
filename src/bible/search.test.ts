import { describe, expect, it, vi } from 'vitest'
import { searchBible } from './search'

describe('busca bíblica no cliente', () => {
  it('uses same-origin gateway and validates navigable results', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ results: [{ book: 'joao', chapter: 3, verse: 16, reference: 'João 3:16' }] }))
    expect(await searchBible('nvt', 'ansiedade', fetcher)).toEqual([{ book: 'joao', chapter: 3, verse: 16, reference: 'João 3:16' }])
    expect(fetcher).toHaveBeenCalledWith('/api/bible?translation=nvt&search=ansiedade', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
  })
  it('refuses malformed provider responses', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ results: [{ book: 'invalid', chapter: 3, verse: 16, reference: 'invalid' }] }))
    await expect(searchBible('nvt', 'termo', fetcher)).rejects.toThrow('Resposta de busca inválida.')
  })
})
