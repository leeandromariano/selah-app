import { describe, expect, it, vi } from 'vitest'
// Server implementation is deliberately outside the frontend import graph.
// @ts-expect-error JavaScript server module has no frontend declaration.
import { runReminderBatch, simulationTransport } from '../../scripts/reminder-worker-core.mjs'
// @ts-expect-error Server adapter is not part of the browser type graph.
import { createWebPushTransport } from '../../scripts/reminder-webpush-transport.mjs'
describe('fronteira de transporte do agendador', () => {
  const job = { job: 'fiction', mode: 'simulation', payload: { kind: 'reading' } }
  function repository() { return { claim: vi.fn().mockResolvedValue(['fiction']), prepare: vi.fn().mockResolvedValue(job), finish: vi.fn().mockResolvedValue(undefined) } }
  it('relógio injetável e simulação registram intenção sem rede', async () => {
    const repo = repository(), transport = simulationTransport()
    await runReminderBatch({ repository: repo, transport, now: () => new Date('2026-10-28T11:17:00Z') })
    expect(repo.prepare).toHaveBeenCalledWith('fiction', '2026-10-28T11:17:00.000Z')
    expect(transport.intents).toEqual([{ job: 'fiction', payload: { kind: 'reading' } }])
    expect(repo.finish).toHaveBeenCalledWith('fiction', 'simulated')
  })
  it('revalida imediatamente antes do transporte e respeita cancelamento do servidor', async () => {
    const repo = repository(), transport = simulationTransport(); repo.prepare.mockResolvedValue(null)
    await runReminderBatch({ repository: repo, transport })
    expect(transport.intents).toHaveLength(0); expect(repo.finish).not.toHaveBeenCalled()
  })
  it.each([[404, 'expired'], [410, 'expired'], [429, 'failed'], [undefined, 'uncertain']])('erro %s não provoca repetição e resulta em %s', async (statusCode, expected) => {
    const repo = repository(), send = vi.fn().mockRejectedValue({ statusCode })
    await runReminderBatch({ repository: repo, transport: { mode: 'simulation', send } })
    expect(send).toHaveBeenCalledOnce(); expect(repo.finish).toHaveBeenCalledWith('fiction', expected)
  })
  it('simulador não encaminha uma assinatura real', async () => {
    const repo = repository(), transport = simulationTransport(); repo.prepare.mockResolvedValue({ ...job, mode: 'webpush' })
    await runReminderBatch({ repository: repo, transport })
    expect(transport.intents).toHaveLength(0); expect(repo.finish).toHaveBeenCalledWith('fiction', 'failed')
  })
  it('transporte real exige autorização específica antes de usar credenciais', () => {
    expect(() => createWebPushTransport({})).toThrow('authorization')
    expect(() => createWebPushTransport({ authorized: true })).toThrow('VAPID')
  })
})
