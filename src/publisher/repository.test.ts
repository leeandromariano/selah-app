import { describe, expect, it, vi } from 'vitest'
import { createPublisherRepository } from './repository'
import type { DevotionalInput } from '../admin/repository'

const draft: DevotionalInput = {
  author_name: 'Autor Convidado', title: 'Mensagem de teste', bible_reference: 'João 14:27',
  bible_text: 'Texto bíblico fictício', content: 'Reflexão fictícia',
  reflection_question: 'Pergunta fictícia?', status: 'draft', publish_at: null,
}
function boundary(allowed: boolean) {
  const table = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn(), update: vi.fn(), single: vi.fn().mockResolvedValue({
      data: { ...draft, id: 'fiction-id', author_id: 'writer', review_requested_at: null }, error: null,
    }),
  }
  for (const name of ['select', 'eq', 'order', 'insert', 'update'] as const) table[name].mockReturnValue(table)
  const rpc = vi.fn().mockImplementation((name: string) =>
    name === 'get_my_publisher_access'
      ? Promise.resolve({ data: allowed, error: null })
      : Promise.resolve({ data: null, error: allowed ? null : { code: '42501' } }))
  const from = vi.fn().mockReturnValue(table)
  return { repo: createPublisherRepository({ from, rpc } as never), from, rpc, table }
}
describe('PUBLICADOR sem privilégios administrativos', () => {
  it('nega qualquer consulta ou mutação sem associação válida', async () => {
    const { repo, from } = boundary(false)
    await expect(repo.list('reader')).rejects.toMatchObject({ code: '42501' })
    await expect(repo.saveDraft('reader', draft)).rejects.toMatchObject({ code: '42501' })
    await expect(repo.submitForReview('test')).rejects.toMatchObject({ code: '42501' })
    expect(from).not.toHaveBeenCalled()
  })
  it('lista exclusivamente conteúdos da própria conta', async () => {
    const { repo, table } = boundary(true)
    await repo.list('writer')
    expect(table.eq).toHaveBeenCalledWith('author_id', 'writer')
    expect(table.range).toHaveBeenCalledWith(0, 99)
  })
  it('cria somente rascunho e grava autor creditado distinto da conta', async () => {
    const { repo, table } = boundary(true)
    await repo.saveDraft('writer', { ...draft, status: 'published', publish_at: new Date().toISOString() })
    expect(table.insert).toHaveBeenCalledWith(expect.objectContaining({
      author_name: 'Autor Convidado', author_id: 'writer', status: 'draft', publish_at: null,
    }))
  })
  it('atualiza somente o próprio registro e não aceita autor em branco', async () => {
    const { repo, table } = boundary(true)
    await repo.saveDraft('writer', draft, 'fiction-id')
    expect(table.eq).toHaveBeenCalledWith('id', 'fiction-id')
    expect(table.eq).toHaveBeenCalledWith('author_id', 'writer')
    await expect(repo.saveDraft('writer', { ...draft, author_name: ' ' })).rejects.toThrow(/autor/)
  })
  it('envia para revisão apenas por RPC protegida, nunca publicando diretamente', async () => {
    const { repo, rpc } = boundary(true)
    await repo.submitForReview('fiction-id')
    expect(rpc).toHaveBeenCalledWith('submit_devotional_for_review', { p_id: 'fiction-id' })
  })
})
