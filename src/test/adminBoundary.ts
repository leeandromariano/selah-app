import { vi } from 'vitest'
import { supabase } from '../lib/supabase'
import type { AdminDevotional } from '../admin/repository'

export const editorialFixture: AdminDevotional = { id: '20000000-0000-4000-8000-000000000001', author_name: 'Autoria Fictícia', review_requested_at: null, title: 'Mensagem Editorial Fictícia', bible_reference: 'Referência fictícia', bible_text: 'Texto fictício', content: 'Reflexão fictícia', reflection_question: 'Pergunta fictícia?', practical_challenge: 'Faça uma pausa fictícia.', prayer_prompt: 'Ore por paz.', publish_at: null, status: 'draft', author_id: '10000000-0000-4000-8000-000000000001', created_at: '2026-10-26T12:00:00Z', updated_at: '2026-10-26T12:00:00Z' }
export function adminBoundary(initial: AdminDevotional[] = [editorialFixture]) {
  let rows = [...initial]
  let payload: Partial<AdminDevotional> = {}
  let id: string | undefined
  let mode: 'create' | 'update' = 'create'
  const table = { select: vi.fn(), order: vi.fn(), range: vi.fn(), insert: vi.fn(), update: vi.fn(), eq: vi.fn(), single: vi.fn() }
  table.select.mockReturnValue(table); table.order.mockReturnValue(table)
  table.range.mockImplementation(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }))
  table.insert.mockImplementation(value => { payload = value; mode = 'create'; return table })
  table.update.mockImplementation(value => { payload = value; mode = 'update'; return table })
  table.eq.mockImplementation((_column, value) => { id = value; return table })
  table.single.mockImplementation(async () => {
    const existing = mode === 'update' ? rows.find(row => row.id === id)! : { ...editorialFixture, id: `created-fiction-${rows.length}` }
    const saved = { ...existing, ...payload, updated_at: '2026-10-26T13:00:00Z' }
    rows = mode === 'update' ? rows.map(row => row.id === id ? saved : row) : [saved, ...rows]
    return { data: saved, error: null }
  })
  vi.mocked(supabase.from).mockReturnValue(table as never)
  vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ devotional_id: editorialFixture.id, total_opens: 93217, unique_readers: 2 }], error: null } as never)
  return table
}
