import { describe, expect, it, vi } from 'vitest'
import { createWhoRepository } from './repository'

const id = '11111111-1111-4111-8111-111111111111'
function client(data: unknown, error: unknown = null) {
  const rpc = vi.fn(() => ({ abortSignal: async () => ({ data, error }) }))
  return { rpc, repository: createWhoRepository({ rpc } as never) }
}
const card = { id, mode: 'base', quote: 'Frase fictícia de teste.', options: ['a', 'b', 'c', 'd'] }

describe('repositório do jogo Quem disse isso?', () => {
  it('inicia a rodada no modo escolhido e descarta campos inesperados, como a resposta certa', async () => {
    const { rpc, repository } = client([{ ...card, correct_index: 2 }])
    const list = await repository.start('base')
    expect(rpc).toHaveBeenCalledWith('who_start', { p_mode: 'base', p_count: 10 })
    expect(list).toEqual([card])
    expect(JSON.stringify(list)).not.toContain('correct_index')
  })
  it.each([['modo desconhecido', 'medio', 10], ['tamanho zero', 'base', 0], ['tamanho grande demais', 'base', 21]])('recusa %s antes de chamar o servidor', async (_name, mode, size) => {
    const { rpc, repository } = client([])
    await expect(repository.start(mode as never, size)).rejects.toThrow('Modalidade inválida')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejeita carta malformada ou de outro modo e propaga erro do servidor', async () => {
    await expect(client([{ ...card, options: ['a'] }]).repository.start('base')).rejects.toThrow('Invalid who card')
    await expect(client([{ ...card, mode: 'profundo' }]).repository.start('base')).rejects.toThrow('Invalid who card')
    await expect(client(null, { code: '42501' }).repository.start('base')).rejects.toEqual({ code: '42501' })
  })
  it('valida e devolve o resultado de uma resposta, recusando inconsistências', async () => {
    const ok = { correct: true, correct_index: 1, context: 'Contexto fictício.', reference: 'Gênesis 4:9', counted: true }
    const { rpc, repository } = client(ok)
    expect(await repository.answer(id, 1)).toEqual(ok)
    expect(rpc).toHaveBeenCalledWith('who_answer', { p_card_id: id, p_selected: 1 })
    await expect(repository.answer(id, 2)).rejects.toThrow('Invalid who answer')
    await expect(repository.answer('x', 1)).rejects.toThrow('Resposta inválida')
    await expect(repository.answer(id, 4)).rejects.toThrow('Resposta inválida')
  })
  it('lê as estatísticas e recusa números impossíveis', async () => {
    expect(await client({ answered: 5, correct: 3, total_cards: 30 }).repository.stats()).toEqual({ answered: 5, correct: 3, total_cards: 30 })
    await expect(client({ answered: 1, correct: 2, total_cards: 30 }).repository.stats()).rejects.toThrow('Invalid who stats')
  })
})
