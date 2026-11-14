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
    expect(changesAnswers('quiz', quizItem, valid())).toBe(false)
    expect(changesAnswers('quiz', quizItem, { ...valid(), prompt: 'Texto novo da pergunta?' })).toBe(false)
    expect(changesAnswers('quiz', quizItem, { ...valid(), correct_index: 2 })).toBe(true)
    expect(changesAnswers('quiz', quizItem, { ...valid(), options: ['a', 'b', 'trocada', 'd'] })).toBe(true)
    expect(changesAnswers('quiz', null, emptyDraft())).toBe(false)
  })
})

describe('validação dos outros jogos', () => {
  const base = () => ({ ...emptyDraft(), prompt: 'Frase fictícia de teste', reference: 'João 3:16' })
  it('Tá na Bíblia: exige veredito e explicação; a referência é opcional', () => {
    expect(validateDraft('claims', { ...base(), explanation: 'curta' })).toContain('explicação')
    expect(validateDraft('claims', { ...base(), explanation: 'Explicação suficiente.', reference: '' })).toBeNull()
    expect(validateDraft('claims', { ...base(), explanation: 'Explicação suficiente.', reference: 'João' })).toContain('capítulo e versículo')
  })
  it('Linha do Tempo: exige era, referência e posição', () => {
    expect(validateDraft('timeline', { ...base(), era: '' })).toContain('era')
    expect(validateDraft('timeline', { ...base(), era: 'Origens', position: 0 })).toContain('posição')
    expect(validateDraft('timeline', { ...base(), era: 'Origens', position: 4 })).toBeNull()
  })
  it('Versículo Oculto: exige um único versículo e 2 ou 3 palavras diferentes', () => {
    const blank = (index: number) => ({ index, answer: 'palavra', prev: 'a' })
    expect(validateDraft('verse', { ...base(), reference: 'João 3:16-17', blanks: [blank(1), blank(2)] })).toContain('único versículo')
    expect(validateDraft('verse', { ...base(), blanks: [blank(1)] })).toContain('2 ou 3 palavras')
    expect(validateDraft('verse', { ...base(), blanks: [blank(1), blank(1)] })).toContain('inválidas')
    expect(validateDraft('verse', { ...base(), blanks: [blank(3), blank(14), blank(28)] })).toBeNull()
  })
  it('sabe quando a mudança zera respostas em cada jogo', () => {
    const card: ContentItem = { id, game: 'claims', prompt: 'Frase', reference: '', active: true, answers_count: 2, verdict: 'distorcida', explanation: 'Explicação.' }
    expect(changesAnswers('claims', card, { ...draftFromItem(card), verdict: 'invencao' })).toBe(false)
    expect(changesAnswers('claims', card, { ...draftFromItem(card), verdict: 'biblia' })).toBe(true)
    const event: ContentItem = { id, game: 'timeline', prompt: 'Evento', reference: 'Gênesis 1:1', active: true, answers_count: 2, era: 'Origens', position: 3 }
    expect(changesAnswers('timeline', event, { ...draftFromItem(event), era: 'Outra era' })).toBe(false)
    expect(changesAnswers('timeline', event, { ...draftFromItem(event), position: 5 })).toBe(true)
    const verse: ContentItem = { id, game: 'verse', prompt: 'João 3:16', reference: 'João 3:16', active: true, answers_count: 2, seq: 1, blanks: [{ index: 3, answer: 'amou', prev: 'Deus' }, { index: 28, answer: 'eterna', prev: 'vida' }] }
    expect(changesAnswers('verse', verse, draftFromItem(verse))).toBe(false)
    expect(changesAnswers('verse', verse, { ...draftFromItem(verse), blanks: [{ index: 3, answer: 'amou', prev: 'Deus' }, { index: 14, answer: 'unigênito', prev: 'Filho' }] })).toBe(true)
  })
})

describe('repositório do conteúdo (owner)', () => {
  it('envia só os campos do jogo ao salvar um versículo oculto', async () => {
    const verse = { id, game: 'verse', prompt: 'João 3:16', reference: 'João 3:16', active: true, answers_count: 0, seq: 17, blanks: [{ index: 3, answer: 'amou', prev: 'Deus' }, { index: 28, answer: 'eterna', prev: 'vida' }] }
    const { rpc, repository } = client({ item: verse, answers_reset: 0 })
    await repository.save('verse', null, { ...emptyDraft(), reference: ' João 3:16 ', blanks: verse.blanks })
    expect(rpc).toHaveBeenCalledWith('owner_content_save', { p_game: 'verse', p_id: null, p_data: { prompt: '', reference: 'João 3:16', active: true, blanks: verse.blanks } })
  })
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
