import { describe, expect, it, vi } from 'vitest'
import { adminColumns, createAdminRepository, dateTimeInput, editorialFields, publicationInstant } from './repository'
import { editorialFixture } from '../test/adminBoundary'

describe('contrato editorial', () => {
  it('valida limites, texto obrigatório e transições de publicação', () => {
    for (const patch of [{ title: '' }, { title: 'x'.repeat(201) }, { bible_reference: '' }, { bible_reference: 'x'.repeat(201) }, { bible_text: '' }, { content: '' }, { reflection_question: '' }, { status: 'other' }, { publish_at: 'invalid' }, { status: 'scheduled', publish_at: null }, { status: 'scheduled', publish_at: '2000-01-01T00:00:00Z' }, { status: 'published', publish_at: '2099-01-01T00:00:00Z' }]) expect(() => editorialFields({ ...editorialFixture, ...patch } as never)).toThrow()
    const result = editorialFields({ ...editorialFixture, title: ' Título válido ' })
    expect(result.title).toBe('Título válido')
    expect(Object.keys(result).sort()).toEqual(['title', 'bible_reference', 'bible_text', 'content', 'reflection_question', 'publish_at', 'status'].sort())
  })
  it('mantém instante original e segundos quando o editor não altera a data', () => {
    const original = '2026-10-26T12:34:56.789Z'
    expect(publicationInstant(dateTimeInput(original), original)).toBe(original)
    expect(publicationInstant('', original)).toBeNull()
    const changed = '2026-10-27T11:30'
    expect(dateTimeInput(publicationInstant(changed, original))).toBe(changed)
    expect(() => publicationInstant('invalid', null)).toThrow()
  })
  it('falha fechada antes da consulta se não houver autorização', async () => {
    const from = vi.fn()
    const rpc = vi.fn().mockResolvedValue({ error: { code: '42501' } })
    const repository = createAdminRepository({ from, rpc } as never)
    await expect(repository.list()).rejects.toMatchObject({ code: '42501' })
    await expect(repository.save('reader', editorialFixture)).rejects.toMatchObject({ code: '42501' })
    expect(from).not.toHaveBeenCalled()
  })
  it('pagina a lista inteira e omite leitores/aberturas da projeção', async () => {
    const query = { select: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 100 }, () => editorialFixture), error: null }).mockResolvedValueOnce({ data: [editorialFixture], error: null }) }
    query.select.mockReturnValue(query); query.order.mockReturnValue(query)
    const repository = createAdminRepository({ rpc: vi.fn().mockResolvedValue({ error: null }), from: vi.fn().mockReturnValue(query) } as never)
    expect(await repository.list()).toHaveLength(101)
    expect(query.range.mock.calls).toEqual([[0, 99], [100, 199]])
    expect(query.select).toHaveBeenCalledWith(adminColumns)
    expect(adminColumns).not.toContain('user_id')
  })
  it('trata zero linhas após alteração de permissões como falha, nunca sucesso', async () => {
    const query = { eq: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }) }
    query.eq.mockReturnValue(query); query.select.mockReturnValue(query)
    const update = vi.fn().mockReturnValue(query)
    const repository = createAdminRepository({ rpc: vi.fn().mockResolvedValue({ error: null }), from: vi.fn().mockReturnValue({ update }) } as never)
    await expect(repository.save('admin', editorialFixture, editorialFixture.id)).rejects.toMatchObject({ code: 'PGRST116' })
    expect(update.mock.calls[0][0]).not.toHaveProperty('author_id')
  })
})
