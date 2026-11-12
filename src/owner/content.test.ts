import { describe, expect, it, vi } from 'vitest'
import { changesAnswers, createOwnerContentRepository, draftFromItem, emptyDraft, validateDraft } from './content'
import type { ContentItem } from './content'

const id = '11111111-1111-4111-8111-111111111111'
const quizItem: ContentItem = { id, game: 'quiz', prompt: 'Pergunta fictícia de teste?', options: ['a', 'b', 'c', 'd'], correct_index: 1, reference: 'João 3:16', active: true, answers_count: 3, testament: 'novo', level: 2 }
function client(data: unknown, error: unknown = null) {
  const rpc = vi.fn(() => ({ abortSignal: async () => ({ data, error }) }))
  return { rpc, repository: createOwnerContentRepository({ rpc } as never) }
}
const valid = () => ({ ...draftFromItem(quizItem) })

describe('validação do rascunho', () => {
  it('aceita um rascunho completo e recusa pergunta curta, alternativas vazias ou repetidas', () => {
    expect(validateDraft('quiz', valid())).toBeNull()
    expect(validateDraft('quiz', { ...valid(), prompt: 'oi' })).toContain('pergunta')
    expect(validateDraft('quiz', { ...valid(), options: ['a', 'b', 'c', ''] })).toContain('4 alternativas')
    expect(validateDraft('quiz', { ...valid(), options: ['a', 'A', 'c', 'd'] })).toContain('diferentes')
  })
  it('exige referência com versículo e, em “Quem disse isso?”, um contexto', () => {
    expect(validateDraft('quiz', { ...valid(), reference: 'João 3' })).toContain('capítulo e versículo')
    expect(validateDraft('quiz', { ...valid(), reference: 'Livro Inexistente 1:1' })).toContain('capítulo e versículo')
    expect(validateDraft('who', { ...valid(), context: 'curto' })).toContain('contexto')
    expect(validateDraft('who', { ...valid(), context: 'Contexto suficientemente longo.' })).toBeNull()
  })
  it('detecta quando alternativas ou resposta certa mudam (o que zera as respostas dos leitores)', () => {
    expect(changesAnswers(quizItem, valid())).toBe(false)
    expect(changesAnswers(quizItem, { ...valid(), prompt: 'Texto novo da pergunta?' })).toBe(false)
    expect(changesAnswers(quizItem, { ...valid(), correct_index: 2 })).toBe(true)
    expect(changesAnswers(quizItem, { ...valid(), options: ['a', 'b', 'trocada', 'd'] })).toBe(true)
    expect(changesAnswers(null, emptyDraft('quiz'))).toBe(false)
  })
})

describe('repositório do conteúdo (owner)', () => {
  it('lista com filtros e descarta campos inesperados', async () => {
    const { rpc, repository } = client({ game: 'quiz', total: 1, page: 0, size: 20, items: [{ ...quizItem, secret: 'x' }] })
    const list = await repository.list('quiz', ' noé ', '2')
    expect(rpc).toHaveBeenCalledWith('owner_content_list', { p_game: 'quiz', p_search: 'noé', p_filter: '2', p_page: 0, p_size: 20 })
    expect(list.items[0]).not.toHaveProperty('secret')
    await expect(client({ game: 'quiz', total: 1, page: 0, size: 20, items: [{ ...quizItem, options: ['a'] }] }).repository.list('quiz')).rejects.toThrow('Invalid content item')
    await expect(client(null, { code: '42501' }).repository.list('quiz')).rejects.toEqual({ code: '42501' })
  })
  it('salva depois de validar e informa quantas respostas foram zeradas', async () => {
    const { rpc, repository } = client({ item: quizItem, answers_reset: 3 })
    const saved = await repository.save('quiz', id, { ...valid(), options: [' a ', 'b', 'c', 'd'] })
    expect(saved.answers_reset).toBe(3)
    expect(rpc).toHaveBeenCalledWith('owner_content_save', { p_game: 'quiz', p_id: id, p_data: expect.objectContaining({ options: ['a', 'b', 'c', 'd'], correct_index: 1, testament: 'novo', level: 2 }) })
    await expect(repository.save('quiz', id, { ...valid(), prompt: '' })).rejects.toMatchObject({ code: '22023' })
    await expect(repository.save('quiz', 'x', valid())).rejects.toThrow('Identificador inválido')
  })
  it('exclui e valida a resposta do servidor', async () => {
    expect(await client({ deleted: true, answers_removed: 2 }).repository.remove('who', id)).toEqual({ answers_removed: 2 })
    await expect(client({ deleted: false, answers_removed: 0 }).repository.remove('who', id)).rejects.toThrow('Invalid delete response')
  })
})
