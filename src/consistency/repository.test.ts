import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConsistencyRepository, consistencyMessage } from './repository'
import { consistencyFixture } from '../test/consistencyBoundary'
function setup(data: unknown = consistencyFixture(), error: unknown = null) {
  const abortSignal = vi.fn().mockResolvedValue({ data, error })
  const rpc = vi.fn().mockReturnValue({ abortSignal })
  return { rpc, abortSignal, repository: createConsistencyRepository({ rpc } as unknown as SupabaseClient) }
}
afterEach(() => vi.useRealTimers())
describe('fronteira das métricas pessoais', () => {
  it('consulta somente RPC autenticada, sem usuário, data atual ou contador enviados', async () => {
    const { repository, rpc, abortSignal } = setup()
    const value = await repository.snapshot()
    expect(rpc).toHaveBeenCalledExactlyOnceWith('get_my_consistency', { p_month: null })
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
    expect(value.status).toBe('empty')
  })
  it('permite seleção explícita de mês sem recalcular métricas no navegador', async () => {
    const { repository, rpc } = setup(consistencyFixture({ month: '2019-01-01' }))
    expect((await repository.snapshot('2019-01-01')).month).toBe('2019-01-01')
    expect(rpc).toHaveBeenCalledWith('get_my_consistency', { p_month: '2019-01-01' })
  })
  it.each(['2026-13-01', '2026-10-02', '0000-01-01', '10000-01-01', 'bad', '2024-02-30'])('rejeita seleção inválida antes da rede: %s', async month => {
    const { repository, rpc } = setup()
    await expect(repository.snapshot(month)).rejects.toThrow('Invalid calendar selection')
    expect(rpc).not.toHaveBeenCalled()
  })
  it.each([
    null, {}, consistencyFixture({ server_today: '2026-10-29' }),
    consistencyFixture({ current_streak: -1 }), consistencyFixture({ best_streak: 5 }),
    consistencyFixture({ total_days: 2, total_devotionals: 1 }), consistencyFixture({ days: [] }),
    consistencyFixture({ days: [{ date: '2026-10-01', completions: -1 }] }),
    consistencyFixture({ time_zone: 'UTC' } as never),
  ])('não inventa números para resposta inválida (%j)', async data => {
    await expect(setup(data).repository.snapshot()).rejects.toThrow('Invalid consistency')
  })
  it('não aceita um mês diferente do pedido', async () => {
    await expect(setup().repository.snapshot('2026-09-01')).rejects.toThrow('Unexpected calendar selection')
  })
  it('preserva data do servidor mesmo quando relógio local está em outro ano', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2099-01-01T00:00:00Z'))
    const snapshot = await setup().repository.snapshot()
    expect(snapshot.server_today).toBe('2026-10-28')
    expect(snapshot.current_month).toBe('2026-10-01')
  })
  it('negação de autorização tem mensagem em português sem dados internos', async () => {
    const value = await setup(null, { code: '42501', message: 'private@example.invalid' }).repository.snapshot().catch(e => e)
    expect(consistencyMessage(value)).toContain('Sua sessão não autoriza')
    expect(consistencyMessage(value)).not.toContain('private@')
  })
  it('falha de transporte tem mensagem genérica sem substituir histórico por zero', async () => {
    const { repository, abortSignal } = setup()
    abortSignal.mockRejectedValueOnce(Error('sensitive data'))
    const error = await repository.snapshot().catch(e => e)
    expect(consistencyMessage(error)).toContain('Verifique sua conexão')
    expect(consistencyMessage(error)).not.toContain('sensitive')
  })
})
