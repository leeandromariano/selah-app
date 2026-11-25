import { describe, expect, it, vi } from 'vitest'
import { completeDevotionalNow } from './instantCompletion'

const id = '20000000-0000-4000-8000-000000000001'
const client = (result: { data?: unknown; error?: unknown }) => ({ rpc: vi.fn().mockResolvedValue({ data: null, error: null, ...result }) }) as never

describe('conclusão sem tempo mínimo', () => {
  it('chama só a função do servidor, só com o id do devocional (nunca usuário, data ou hora)', async () => {
    const c = client({ data: { status: 'completed', completed_at: '2026-11-13T12:00:00Z', completed_day: '2026-11-13', revision: 1 } })
    expect(await completeDevotionalNow(c, id)).toEqual({ completed_at: '2026-11-13T12:00:00Z', completed_day: '2026-11-13' })
    expect((c as unknown as { rpc: { mock: { calls: unknown[][] } } }).rpc.mock.calls).toEqual([['complete_devotional_now', { p_devotional_id: id }]])
  })
  it.each([
    ['erro do servidor', { error: { message: 'segredo interno' } }],
    ['devocional indisponível', { data: { status: 'unavailable' } }],
    ['resposta vazia', { data: null }],
    ['data inválida', { data: { status: 'completed', completed_at: '2026-11-13T12:00:00Z', completed_day: '13/11/2026' } }],
  ])('falha com mensagem genérica: %s', async (_name, result) => {
    await expect(completeDevotionalNow(client(result), id)).rejects.toThrow('Não foi possível concluir agora.')
  })
})
