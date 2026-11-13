import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error Módulo de servidor em JavaScript, fora do grafo do frontend.
import { createHostedRepository, runHostedCycle } from '../../scripts/hosted-reminder-repository.mjs'

const KEY = 'chave-publica'
function repo(mode: string, key = KEY) {
  return {
    configuration: vi.fn().mockResolvedValue({ mode, vapid_public_key: key }),
    proofs: vi.fn().mockResolvedValue([{ proof: 1 }]), cleanup: vi.fn().mockResolvedValue(undefined),
  }
}
describe('agendador hospedado', () => {
  it('em modo simulação não reivindica nem envia nada', async () => {
    const r = repo('simulation'), runBatch = vi.fn(), transport = { send: vi.fn() }
    expect(await runHostedCycle({ repository: r, transport, publicKey: KEY, runBatch })).toEqual({ skipped: 'banco em modo de simulação' })
    expect(runBatch).not.toHaveBeenCalled(); expect(transport.send).not.toHaveBeenCalled(); expect(r.cleanup).not.toHaveBeenCalled()
  })
  it('recusa chave pública diferente da do servidor', async () => {
    await expect(runHostedCycle({ repository: repo('webpush', 'outra'), transport: { send: vi.fn() }, publicKey: KEY, runBatch: vi.fn() })).rejects.toThrow('differs')
  })
  it('em webpush envia provas, processa o lote e limpa; log só com contagens', async () => {
    const r = repo('webpush'), send = vi.fn().mockResolvedValue(undefined)
    const runBatch = vi.fn().mockResolvedValue([{ id: 'a', outcome: 'accepted' }, { id: 'b', outcome: 'expired' }])
    expect(await runHostedCycle({ repository: r, transport: { send }, publicKey: KEY, runBatch })).toEqual({ attempts: 2, accepted: 1, notices: 0, noticesAccepted: 0 })
    expect(send).toHaveBeenCalledOnce(); expect(r.cleanup).toHaveBeenCalled()
  })
  it('falha de uma prova não derruba o ciclo', async () => {
    const send = vi.fn().mockRejectedValue(Error('x'))
    await expect(runHostedCycle({ repository: repo('webpush'), transport: { send }, publicKey: KEY, runBatch: vi.fn().mockResolvedValue([]) })).resolves.toEqual({ attempts: 0, accepted: 0, notices: 0, noticesAccepted: 0 })
  })
  it('processa também os avisos de devocional nova com o repositório próprio', async () => {
    const r = { ...repo('webpush'), notices: { tag: 'notices' } }
    const runBatch = vi.fn().mockImplementation(async ({ repository }: { repository: { tag?: string } }) => repository.tag === 'notices' ? [{ id: 'n', outcome: 'accepted' }] : [])
    expect(await runHostedCycle({ repository: r, transport: { send: vi.fn() }, publicKey: KEY, runBatch })).toEqual({ attempts: 0, accepted: 0, notices: 1, noticesAccepted: 1 })
    expect(runBatch).toHaveBeenCalledTimes(2)
  })
  it('o repositório de avisos usa parâmetros e pede modo webpush', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'x' }] })
    const repository = createHostedRepository({ query })
    expect(await repository.notices.claim('2026-11-12T10:00:00Z')).toEqual(['x'])
    expect(query.mock.calls[0][0]).toContain('claim_publish_notices')
    expect(query.mock.calls[0][1]).toEqual(['2026-11-12T10:00:00Z', 'webpush'])
  })
  it('o repositório usa parâmetros e sempre pede modo webpush', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'x' }] })
    const repository = createHostedRepository({ query })
    expect(await repository.claim('2026-11-12T10:00:00Z')).toEqual(['x'])
    expect(query.mock.calls[0][1]).toEqual(['2026-11-12T10:00:00Z', 'webpush'])
    expect(query.mock.calls[0][0]).not.toContain('2026-11-12')
  })
})
