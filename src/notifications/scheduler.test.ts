import { webcrypto } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
// @ts-expect-error Biblioteca de servidor, sem declaração de tipos.
import webpush from 'web-push'
import { createFetchTransport, outcomeOf, runBatch, runSchedulerCycle, statusOf, transportSelfTest, vapidPairMatches } from '../../supabase/functions/_shared/reminder-scheduler'
import type { PushJob, Rpc } from '../../supabase/functions/_shared/reminder-scheduler'

// O jsdom não tem crypto.subtle (a Edge Function usa o do runtime): aqui usamos o do Node.
beforeAll(() => { vi.stubGlobal('crypto', webcrypto) })
const keys = webpush.generateVAPIDKeys()
const config = { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: 'mailto:operador@example.invalid' }
const job = (id = 'j1', extra: object = {}): PushJob => ({ job: id, mode: 'webpush', subscription: { endpoint: 'https://push.example.invalid/x', keys: { p256dh: 'A'.repeat(87), auth: 'A'.repeat(22) } }, payload: { v: 1, kind: 'reading' }, ...extra })

describe('núcleo do agendador de lembretes', () => {
  it.each([[404, 'expired'], [410, 'expired'], [429, 'failed'], [500, 'failed'], [undefined, 'uncertain']])('erro %s resulta em %s e nunca é repetido', async (statusCode, expected) => {
    expect(outcomeOf({ statusCode })).toBe(expected)
    const send = vi.fn().mockRejectedValue({ statusCode }), finish = vi.fn().mockResolvedValue(undefined)
    await runBatch({ ids: ['a'], prepare: async () => job(), finish, transport: { send } })
    expect(send).toHaveBeenCalledOnce(); expect(finish).toHaveBeenCalledWith('a', expected)
  })
  it('lote: envia, registra aceito, pula o que o servidor cancelou e recusa job que não é webpush', async () => {
    const send = vi.fn().mockResolvedValue(undefined), finish = vi.fn().mockResolvedValue(undefined)
    const jobs: Record<string, PushJob | null> = { a: job('a'), b: null, c: job('c', { mode: 'simulation' }) }
    const results = await runBatch({ ids: ['a', 'b', 'c'], prepare: async id => jobs[id], finish, transport: { send } })
    expect(results).toEqual([{ id: 'a', outcome: 'accepted' }, { id: 'c', outcome: 'failed' }])
    expect(send).toHaveBeenCalledOnce(); expect(finish).not.toHaveBeenCalledWith('b', expect.anything())
  })
  it('transporte exige configuração VAPID válida antes de usar credenciais', () => {
    const lib = { generateRequestDetails: vi.fn() }
    for (const bad of [{}, { publicKey: 'x', privateKey: 'y', subject: 'mailto:a@b.c' }, { ...config, subject: 'https://x' }]) expect(() => createFetchTransport({ lib, ...bad })).toThrow('VAPID')
  })
  it('transporte criptografa pela biblioteca, envia por fetch sem content-length e trata a resposta', async () => {
    const generate = vi.fn().mockReturnValue({ endpoint: 'https://push.example.invalid/x', method: 'POST', headers: { 'Content-Length': '10', Authorization: 'vapid t=1', TTL: '600' }, body: new Uint8Array([1, 2]) })
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 201 }))
    await createFetchTransport({ lib: { generateRequestDetails: generate }, ...config, fetchImpl }).send(job())
    expect(generate).toHaveBeenCalledWith(job().subscription, JSON.stringify({ v: 1, kind: 'reading' }), expect.objectContaining({ TTL: 600, vapidDetails: config }))
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://push.example.invalid/x')
    expect(init).toMatchObject({ method: 'POST', redirect: 'error', headers: { Authorization: 'vapid t=1', TTL: '600' } })
    expect(init.headers).not.toHaveProperty('Content-Length')
    const rejected = createFetchTransport({ lib: { generateRequestDetails: generate }, ...config, fetchImpl: vi.fn().mockResolvedValue(new Response(null, { status: 410 })) })
    await expect(rejected.send(job())).rejects.toMatchObject({ statusCode: 410 })
  })
  it('autoteste prova criptografia e assinatura VAPID com a biblioteca real, sem rede', async () => {
    expect(await transportSelfTest(webpush as never, config)).toEqual({ selfTest: 'ok', vapidPair: 'ok' })
    expect(await transportSelfTest(webpush as never, { ...config, privateKey: 'invalida' })).toMatchObject({ selfTest: 'falhou' })
  })
  it('confere se a chave privada VAPID é do mesmo par da pública (pega a mistura de pares)', async () => {
    const other = webpush.generateVAPIDKeys()
    expect(await vapidPairMatches(keys.publicKey, keys.privateKey)).toBe(true)
    expect(await vapidPairMatches(keys.publicKey, other.privateKey)).toBe(false)
    expect(await vapidPairMatches(other.publicKey, keys.privateKey)).toBe(false)
    expect(await vapidPairMatches('curta', keys.privateKey)).toBe(false)
    expect(await vapidPairMatches(keys.publicKey, undefined)).toBe(false)
    expect(await transportSelfTest(webpush as never, { ...config, privateKey: other.privateKey })).toEqual({ selfTest: 'ok', vapidPair: 'diferente' })
  })
  it('código de resposta do envio: número do provedor ou rede, nunca texto do erro', () => {
    expect(statusOf({ statusCode: 403, message: 'segredo' })).toBe('403')
    expect(statusOf(new Error('segredo'))).toBe('rede')
  })
  it('a biblioteca real gera um pedido de envio válido para uma assinatura real, com o envio por fetch simulado', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
    const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url')
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 201 }))
    const transport = createFetchTransport({ lib: webpush as never, ...config, fetchImpl })
    await transport.send(job('r', { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: b64(raw), auth: b64(crypto.getRandomValues(new Uint8Array(16))) } } }))
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://fcm.googleapis.com/fcm/send/abc')
    expect(init.headers['Content-Encoding']).toBe('aes128gcm')
    expect(init.headers.Authorization).toMatch(/^vapid t=/)
    expect((init.body as Uint8Array).byteLength).toBeGreaterThan(0)
  })

  function fakeRpc(state: { mode: string; publicKey: string | null; reminderIds?: string[]; noticeIds?: string[]; proofs?: PushJob[] }) {
    const calls: string[] = []
    const rpc: Rpc = vi.fn(async (name: string, args?: Record<string, unknown>) => {
      calls.push(name)
      if (name === 'scheduler_config') return { mode: state.mode, vapid_public_key: state.publicKey }
      if (name === 'scheduler_claim_proofs') return state.proofs ?? []
      if (name === 'scheduler_claim_reminders') return state.reminderIds ?? []
      if (name === 'scheduler_claim_notices') return state.noticeIds ?? []
      if (name === 'scheduler_prepare_reminder' || name === 'scheduler_prepare_notice') return job(String(args?.p_id))
      return null
    })
    return { rpc, calls }
  }
  it('em simulação não reivindica nada nem envia', async () => {
    const { rpc, calls } = fakeRpc({ mode: 'simulation', publicKey: null })
    const send = vi.fn()
    expect(await runSchedulerCycle({ rpc, transport: { send }, publicKey: keys.publicKey })).toEqual({ skipped: 'banco em modo de simulação' })
    expect(calls).toEqual(['scheduler_config']); expect(send).not.toHaveBeenCalled()
  })
  it('recusa chave pública VAPID diferente da do banco', async () => {
    const { rpc } = fakeRpc({ mode: 'webpush', publicKey: 'outra' })
    await expect(runSchedulerCycle({ rpc, transport: { send: vi.fn() }, publicKey: keys.publicKey })).rejects.toThrow('differs')
  })
  it('ciclo em webpush: provas, lembretes, avisos de devocional e limpeza, com o relógio injetado e só contagens no resultado', async () => {
    const proof = job('', { job: undefined })
    const { rpc, calls } = fakeRpc({ mode: 'webpush', publicKey: keys.publicKey, reminderIds: ['r1', 'r2'], noticeIds: ['n1'], proofs: [proof] })
    const send = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockRejectedValueOnce({ statusCode: 410 }).mockResolvedValueOnce(undefined)
    const result = await runSchedulerCycle({ rpc, transport: { send }, publicKey: keys.publicKey, now: () => new Date('2026-11-13T18:00:00Z') })
    expect(result).toEqual({ proofs: 1, proofsAccepted: 1, attempts: 2, accepted: 1, notices: 1, noticesAccepted: 1, erros: { '410': 1 } })
    expect(calls).toEqual(['scheduler_config', 'scheduler_claim_proofs', 'scheduler_claim_reminders', 'scheduler_prepare_reminder', 'scheduler_finish_reminder', 'scheduler_prepare_reminder', 'scheduler_finish_reminder',
      'scheduler_claim_notices', 'scheduler_prepare_notice', 'scheduler_finish_notice', 'scheduler_cleanup'])
    expect(vi.mocked(rpc).mock.calls.find(call => call[0] === 'scheduler_claim_reminders')![1]).toEqual({ p_now: '2026-11-13T18:00:00.000Z' })
    expect(vi.mocked(rpc).mock.calls.filter(call => call[0] === 'scheduler_finish_reminder').map(call => call[1])).toEqual([{ p_id: 'r1', p_result: 'accepted' }, { p_id: 'r2', p_result: 'expired' }])
  })
  it('falha em uma prova não derruba o ciclo', async () => {
    const { rpc } = fakeRpc({ mode: 'webpush', publicKey: keys.publicKey, proofs: [job('', { job: undefined })] })
    const send = vi.fn().mockRejectedValue(Error('x'))
    await expect(runSchedulerCycle({ rpc, transport: { send }, publicKey: keys.publicKey })).resolves.toMatchObject({ proofs: 1, proofsAccepted: 0, attempts: 0, erros: { rede: 1 } })
  })
})
