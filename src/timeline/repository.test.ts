import { describe, expect, it, vi } from 'vitest'
import { createTimelineRepository } from './repository'

const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222'
function client(data: unknown, error: unknown = null) {
  const rpc = vi.fn(() => ({ abortSignal: async () => ({ data, error }) }))
  return { rpc, repository: createTimelineRepository({ rpc } as never) }
}
const pair = { left: { id: a, title: 'Evento fictício A' }, right: { id: b, title: 'Evento fictício B' } }
const ok = { correct: true, counted: true, first: { id: a, title: 'Evento fictício A', era: 'Era', reference: 'Gênesis 1:1' }, second: { id: b, title: 'Evento fictício B', era: 'Era', reference: 'Gênesis 2:1' } }

describe('repositório da Linha do Tempo', () => {
  it('inicia a rodada e descarta campos inesperados, como a posição cronológica', async () => {
    const { rpc, repository } = client([{ left: { ...pair.left, position: 1 }, right: { ...pair.right, position: 2 } }])
    const list = await repository.start()
    expect(rpc).toHaveBeenCalledWith('timeline_start', { p_count: 10 })
    expect(list).toEqual([pair])
    expect(JSON.stringify(list)).not.toContain('position')
  })
  it('recusa tamanho inválido, par malformado ou repetido e propaga erro do servidor', async () => {
    const { rpc, repository } = client([])
    await expect(repository.start(0)).rejects.toThrow('Tamanho inválido')
    expect(rpc).not.toHaveBeenCalled()
    await expect(client([{ left: { id: 'x', title: 'a' }, right: pair.right }]).repository.start()).rejects.toThrow('Invalid timeline event')
    await expect(client([{ left: pair.left, right: pair.left }]).repository.start()).rejects.toThrow('Invalid timeline pair')
    await expect(client(null, { code: '42501' }).repository.start()).rejects.toEqual({ code: '42501' })
  })
  it('valida a resposta e a coerência entre escolha, ordem e acerto', async () => {
    const { rpc, repository } = client(ok)
    expect(await repository.answer(a, b, a)).toEqual(ok)
    expect(rpc).toHaveBeenCalledWith('timeline_answer', { p_left: a, p_right: b, p_chosen: a })
    await expect(repository.answer(a, b, b)).rejects.toThrow('Invalid timeline answer')
    await expect(repository.answer(a, a, a)).rejects.toThrow('Resposta inválida')
    await expect(repository.answer(a, b, '33333333-3333-4333-8333-333333333333')).rejects.toThrow('Resposta inválida')
    await expect(client({ ...ok, first: { ...ok.first, id: '33333333-3333-4333-8333-333333333333' } }).repository.answer(a, b, a)).rejects.toThrow('Invalid timeline answer')
  })
  it('lê as estatísticas e recusa números impossíveis', async () => {
    expect(await client({ answered: 4, correct: 3, total_events: 61 }).repository.stats()).toEqual({ answered: 4, correct: 3, total_events: 61 })
    await expect(client({ answered: 1, correct: 2, total_events: 61 }).repository.stats()).rejects.toThrow('Invalid timeline stats')
  })
})
