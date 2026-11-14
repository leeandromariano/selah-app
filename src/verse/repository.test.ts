import { describe, expect, it, vi } from 'vitest'
import { createVerseRepository } from './repository'

const state = { number: 3, reference: 'João 3:16', max_attempts: 4, blanks: [{ index: 3, length: 4, prev: 'deus' }, { index: 14, length: 9, prev: 'filho' }], attempts: [], finished: false, solved: false, streak: 0, answers: null }
function client(data: unknown, error: unknown = null) {
  const rpc = vi.fn(() => ({ abortSignal: async () => ({ data, error }) }))
  return { rpc, repository: createVerseRepository({ rpc } as never) }
}

describe('repositório do Versículo Oculto', () => {
  it('lê o desafio do dia sem as palavras escondidas e descarta campos inesperados', async () => {
    const { rpc, repository } = client({ ...state, blanks: [{ ...state.blanks[0], answer: 'amou' }, state.blanks[1]], extra: 'x' })
    const result = await repository.today()
    expect(rpc).toHaveBeenCalledWith('verse_today', {})
    expect(JSON.stringify(result)).not.toContain('amou')
    expect(result).not.toHaveProperty('extra')
  })
  it('recusa estado inconsistente (respostas antes de terminar, tentativas demais, grade com tamanho errado)', async () => {
    await expect(client({ ...state, answers: ['a', 'b'] }).repository.today()).rejects.toThrow('Invalid verse state')
    await expect(client({ ...state, finished: true, answers: null }).repository.today()).rejects.toThrow('Invalid verse state')
    await expect(client({ ...state, attempts: Array(5).fill({ results: [true, true] }) }).repository.today()).rejects.toThrow('Invalid verse state')
    await expect(client({ ...state, attempts: [{ results: [true] }] }).repository.today()).rejects.toThrow('Invalid verse state')
    await expect(client(null, { code: '42501' }).repository.today()).rejects.toEqual({ code: '42501' })
  })
  it('envia a tentativa e devolve o resultado por palavra', async () => {
    const answer = { ...state, attempts: [{ results: [true, false] }], results: [true, false], streak: 0 }
    const { rpc, repository } = client(answer)
    const result = await repository.guess([' amou ', 'x'])
    expect(rpc).toHaveBeenCalledWith('verse_guess', { p_words: ['amou', 'x'] })
    expect(result.results).toEqual([true, false])
    await expect(repository.guess([''])).rejects.toThrow('Resposta inválida')
    await expect(client({ ...answer, results: [true] }).repository.guess(['a', 'b'])).rejects.toThrow('Invalid verse result')
  })
})
