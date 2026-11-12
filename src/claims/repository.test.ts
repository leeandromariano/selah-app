import { describe, expect, it, vi } from 'vitest'
import { createClaimsRepository } from './repository'

const id = '11111111-1111-4111-8111-111111111111'
function client(data: unknown, error: unknown = null) {
  const rpc = vi.fn(() => ({ abortSignal: async () => ({ data, error }) }))
  return { rpc, repository: createClaimsRepository({ rpc } as never) }
}
const answer = { correct: true, verdict: 'biblia', explanation: 'Explicação fictícia de teste.', reference: 'João 3:16', counted: true }

describe('repositório do jogo Tá na Bíblia ou Tá Amarrado?', () => {
  it('inicia a rodada com 5 cartas e descarta campos inesperados, como o veredito', async () => {
    const { rpc, repository } = client([{ id, statement: 'Frase fictícia.', verdict: 'invencao' }])
    const list = await repository.start()
    expect(rpc).toHaveBeenCalledWith('claims_start', { p_count: 5 })
    expect(list).toEqual([{ id, statement: 'Frase fictícia.' }])
    expect(JSON.stringify(list)).not.toContain('verdict')
  })
  it('recusa tamanho inválido, carta malformada e propaga erro do servidor', async () => {
    const { rpc, repository } = client([])
    await expect(repository.start(0)).rejects.toThrow('Tamanho inválido')
    expect(rpc).not.toHaveBeenCalled()
    await expect(client([{ id: 'x', statement: 'a' }]).repository.start()).rejects.toThrow('Invalid claim card')
    await expect(client(null, { code: '42501' }).repository.start()).rejects.toEqual({ code: '42501' })
  })
  it('valida a resposta e confere se o acerto é coerente com o veredito', async () => {
    const { rpc, repository } = client(answer)
    expect(await repository.answer(id, true)).toEqual(answer)
    expect(rpc).toHaveBeenCalledWith('claims_answer', { p_card_id: id, p_said_in_bible: true })
    await expect(repository.answer(id, false)).rejects.toThrow('Invalid claim answer')
    expect((await client({ ...answer, correct: true, verdict: 'invencao', reference: null }).repository.answer(id, false)).reference).toBeNull()
    await expect(repository.answer('x', true)).rejects.toThrow('Resposta inválida')
  })
  it('lê as estatísticas e recusa números impossíveis', async () => {
    expect(await client({ answered: 4, correct: 3, total_cards: 24 }).repository.stats()).toEqual({ answered: 4, correct: 3, total_cards: 24 })
    await expect(client({ answered: 1, correct: 2, total_cards: 24 }).repository.stats()).rejects.toThrow('Invalid claim stats')
  })
})
