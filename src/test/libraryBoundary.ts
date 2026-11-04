import { vi } from 'vitest'
import { supabase } from '../lib/supabase'
import type { Publication, Opening } from '../devotionals/repository'

export function libraryBoundary(publications: Publication[], initialOpenings: Opening[] = []) {
  let history = [...initialOpenings]
  const publicationsQuery = { select: vi.fn(), eq: vi.fn(), lte: vi.fn(), order: vi.fn(), range: vi.fn().mockImplementation(async (from: number, to: number) => ({ data: publications.slice(from, to + 1), error: null })) }
  const historyQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn().mockImplementation(async (from: number, to: number) => ({ data: history.slice(from, to + 1), error: null })), insert: vi.fn(), single: vi.fn() }
  for (const method of ['select', 'eq', 'lte', 'order'] as const) publicationsQuery[method].mockReturnValue(publicationsQuery)
  for (const method of ['select', 'eq', 'order'] as const) historyQuery[method].mockReturnValue(historyQuery)
  historyQuery.insert.mockImplementation((payload: { devotional_id: string }) => {
    historyQuery.single.mockImplementation(async () => {
      const event = { id: `fiction-${history.length}`, devotional_id: payload.devotional_id, opened_at: new Date().toISOString() }
      history = [event, ...history]
      return { data: event, error: null }
    })
    return historyQuery
  })
  const completionsQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValue({ data: [], error: null }) }
  for (const method of ['select', 'eq', 'order'] as const) completionsQuery[method].mockReturnValue(completionsQuery)
  vi.mocked(supabase.from).mockImplementation(table => (table === 'devotionals' ? publicationsQuery : table === 'devotional_completions' ? completionsQuery : historyQuery) as never)
  return { publicationsQuery, historyQuery, completionsQuery }
}

export const olderPublications: Publication[] = [
  { id: '20000000-0000-4000-8000-000000000001', author_name: 'Autoria Fictícia', title: 'Paz em meio ao caminho', bible_reference: 'João 14:27', bible_text: 'Texto bíblico fictício', content: 'Reflexão fictícia sobre a paz.', reflection_question: 'Pergunta fictícia?', publish_at: '2020-10-22T12:00:00Z', reading_revision: 1 },
  { id: '20000000-0000-4000-8000-000000000002', author_name: 'Outro Autor Fictício', title: 'O extraordinário no simples', bible_reference: 'Salmos 118:24', bible_text: 'Texto bíblico fictício', content: 'Reflexão fictícia sobre gratidão.', reflection_question: 'Pergunta fictícia?', publish_at: '2020-10-21T12:00:00Z', reading_revision: 1 },
]
