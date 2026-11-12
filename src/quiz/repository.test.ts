import { describe, expect, it, vi } from 'vitest'
import { createQuizRepository } from './repository'

const id = '11111111-1111-4111-8111-111111111111'
function client(data: unknown, error: unknown = null) {
  const rpc = vi.fn(() => ({ abortSignal: async () => ({ data, error }) }))
  return { rpc, repository: createQuizRepository({ rpc } as never) }
}
const question = { id, testament: 'novo', prompt: 'Pergunta fictícia?', options: ['a', 'b', 'c', 'd'] }

describe('repositório do quiz', () => {
  it('inicia uma rodada e descarta campos inesperados, como a resposta certa', async () => {
    const { rpc, repository } = client([{ ...question, correct_index: 2 }])
    const list = await repository.start('novo')
    expect(rpc).toHaveBeenCalledWith('quiz_start', { p_mode: 'novo', p_count: 10 })
    expect(list).toEqual([question])
    expect(JSON.stringify(list)).not.toContain('correct_index')
  })
  it.each([['modalidade desconhecida', 'todas', 10], ['tamanho zero', 'novo', 0], ['tamanho grande demais', 'novo', 21]])('recusa %s antes de chamar o servidor', async (_name, mode, size) => {
    const { rpc, repository } = client([])
    await expect(repository.start(mode as never, size)).rejects.toThrow('Modalidade inválida')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejeita pergunta malformada e propaga erro do servidor', async () => {
    await expect(client([{ ...question, options: ['a', 'b'] }]).repository.start('biblia')).rejects.toThrow('Invalid quiz question')
    await expect(client([{ ...question, id: 'nao-uuid' }]).repository.start('biblia')).rejects.toThrow('Invalid quiz question')
    await expect(client(null, { code: '42501' }).repository.start('biblia')).rejects.toEqual({ code: '42501' })
  })
  it('valida e devolve o resultado de uma resposta', async () => {
    const { rpc, repository } = client({ correct: true, correct_index: 1, reference: 'João 3:16', counted: true })
    expect(await repository.answer(id, 1)).toEqual({ correct: true, correct_index: 1, reference: 'João 3:16', counted: true })
    expect(rpc).toHaveBeenCalledWith('quiz_answer', { p_question_id: id, p_selected: 1 })
    await expect(repository.answer('x', 1)).rejects.toThrow('Resposta inválida')
    await expect(repository.answer(id, 4)).rejects.toThrow('Resposta inválida')
  })
  it('recusa resultado inconsistente (acerto que não bate com a alternativa escolhida)', async () => {
    await expect(client({ correct: true, correct_index: 2, reference: 'João 3:16', counted: true }).repository.answer(id, 1)).rejects.toThrow('Invalid quiz answer')
  })
  it('lê as estatísticas pessoais e recusa números impossíveis', async () => {
    expect(await client({ answered: 10, correct: 4, total_questions: 48 }).repository.stats()).toEqual({ answered: 10, correct: 4, total_questions: 48 })
    await expect(client({ answered: 3, correct: 4, total_questions: 48 }).repository.stats()).rejects.toThrow('Invalid quiz stats')
  })
  it('consulta o ranking do owner com busca normalizada e valida cada linha', async () => {
    const player = { username: 'leitor_teste', answered: 10, correct: 7, accuracy: 70, antigo_correct: 3, novo_correct: 4, last_answered_at: '2026-11-11T10:00:00Z', email: 'segredo@example.com' }
    const { rpc, repository } = client({ total_players: 1, matched_players: 1, total_questions: 48, page: 0, size: 25, players: [player] })
    const ranking = await repository.ranking('  @Leitor ')
    expect(rpc).toHaveBeenCalledWith('get_owner_quiz_ranking', { p_search: 'leitor', p_page: 0, p_size: 25 })
    expect(ranking.players[0]).not.toHaveProperty('email')
    await expect(repository.ranking('a b')).rejects.toThrow('Consulta inválida')
    await expect(client({ total_players: 1, matched_players: 1, total_questions: 48, page: 0, size: 25, players: [{ ...player, correct: 11 }] }).repository.ranking()).rejects.toThrow('Invalid quiz ranking')
  })
})
