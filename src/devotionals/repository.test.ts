import { describe, expect, it, vi } from 'vitest'
import { createDevotionalRepository, localDay, publishedToday, toCard, publicationColumns } from './repository'
import { olderPublications } from '../test/libraryBoundary'

describe('publicações e calendário', () => {
  it('usa São Paulo nas fronteiras da meia-noite e escolhe somente publicação do dia já liberada', () => {
    expect(localDay('2026-10-27T02:59:59Z')).toBe('2026-10-26')
    expect(localDay('2026-10-27T03:00:00Z')).toBe('2026-10-27')
    const entries = [
      { ...olderPublications[0], id: 'a', publish_at: '2026-10-26T15:00:00Z' },
      { ...olderPublications[0], id: 'b', publish_at: '2026-10-26T18:00:00Z' },
      { ...olderPublications[0], id: 'c', publish_at: '2026-10-26T23:00:00Z' },
    ]
    expect(publishedToday(entries, new Date('2026-10-26T20:00:00Z'))?.id).toBe('b')
    expect(publishedToday(entries, new Date('2026-10-28T20:00:00Z'))).toBeNull()
  })
  it('adapta conteúdo sem inventar tema e estima tempo, sem expor autoria administrativa', () => {
    const card = toCard({ ...olderPublications[0], content: 'palavra '.repeat(450) })
    expect(card.theme).toBe('Devocional')
    expect(card.summary).toHaveLength(151)
    expect(card.minutes).toBe(3)
    expect(card.reference).toBe(olderPublications[0].bible_reference)
    expect(card.author).toBe('Autoria Fictícia')
    expect(card).not.toHaveProperty('author_id')
  })
  it('filtra publicados/data, ordena e busca todas as páginas além do limite de resposta', async () => {
    const query = { select: vi.fn(), eq: vi.fn(), lte: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 100 }, () => olderPublications[0]), error: null }).mockResolvedValueOnce({ data: [olderPublications[1]], error: null }) }
    for (const method of ['select', 'eq', 'lte', 'order'] as const) query[method].mockReturnValue(query)
    const from = vi.fn().mockReturnValue(query)
    const repository = createDevotionalRepository({ from } as never)
    const now = new Date('2026-10-26T12:00:00Z')
    expect(await repository.published(now)).toHaveLength(101)
    expect(from).toHaveBeenCalledWith('devotionals')
    expect(query.select).toHaveBeenCalledWith(publicationColumns)
    expect(query.eq).toHaveBeenCalledWith('status', 'published')
    expect(query.lte).toHaveBeenCalledWith('publish_at', now.toISOString())
    expect(query.order).toHaveBeenCalledWith('publish_at', { ascending: false })
    expect(query.range.mock.calls).toEqual([[0, 99], [100, 199]])
  })
  it('registra somente devotional_id e propaga negação sem falso sucesso', async () => {
    const query = { insert: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } }) }
    query.insert.mockReturnValue(query); query.select.mockReturnValue(query)
    const repository = createDevotionalRepository({ from: vi.fn().mockReturnValue(query) } as never)
    await expect(repository.open('fictional-id')).rejects.toMatchObject({ code: '42501' })
    expect(query.insert).toHaveBeenCalledWith({ devotional_id: 'fictional-id' })
  })
})
