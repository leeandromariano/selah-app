import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createReadingRepository } from './repository'

function client(pages: unknown[][], error: unknown = null) {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() }
  for (const method of ['select', 'eq', 'order'] as const) query[method].mockReturnValue(query)
  pages.forEach(page => query.range.mockResolvedValueOnce({ data: page, error }))
  const from = vi.fn().mockReturnValue(query)
  return { from, query, repository: createReadingRepository({ from } as unknown as SupabaseClient) }
}
const row = (n: number) => ({ source_devotional_id: 'id' + n, devotional_id: 'id' + n, completed_at: '2026-11-13T12:00:00Z', completed_day: '2026-11-13' })

describe('repositório de leitura (conclusões)', () => {
  it('lista só as conclusões do próprio leitor, da mais recente para a mais antiga', async () => {
    const { repository, from, query } = client([[row(1), row(2)]])
    expect(await repository.completions('reader')).toHaveLength(2)
    expect(from).toHaveBeenCalledWith('devotional_completions')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'reader')
    expect(query.order).toHaveBeenCalledWith('completed_at', { ascending: false })
    expect(query.range).toHaveBeenCalledWith(0, 99)
  })
  it('lê em páginas de 100 até acabar', async () => {
    const full = Array.from({ length: 100 }, (_, i) => row(i))
    const { repository, query } = client([full, [row(200)]])
    expect(await repository.completions('reader')).toHaveLength(101)
    expect(query.range).toHaveBeenNthCalledWith(2, 100, 199)
  })
  it('propaga falha do servidor e recusa resposta inesperada', async () => {
    await expect(client([[]], { code: '42501' }).repository.completions('reader')).rejects.toEqual({ code: '42501' })
    const odd = client([]); odd.query.range.mockResolvedValueOnce({ data: null, error: null })
    await expect(odd.repository.completions('reader')).rejects.toThrow('Invalid completions response')
  })
})
