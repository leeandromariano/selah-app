import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let permission = 'default'
let hasKey = true
const subscribe = vi.fn(), getSubscription = vi.fn(), bind = vi.fn(), proof = vi.fn()
vi.mock('./device', () => ({
  deviceKey: (_user: string, create = false) => create || hasKey ? { id: 'id', secret: 's' } : null,
  notificationPermission: () => permission,
  reminderWorker: async () => ({ pushManager: { getSubscription, subscribe } }),
  workerMessage: (...args: unknown[]) => proof(...args),
}))
vi.mock('./session', () => ({ bindReminderDevice: (...args: unknown[]) => bind(...args) }))
import { activateReminders, confirmPendingDevice, rearmReminders } from './activate'

const vapid = 'B'.repeat(87)
const snap = (over: object = {}) => ({ enabled: false, mode: 'webpush', vapid_public_key: vapid, device: null, last: null, ...over })
const sub = { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/x', keys: {} }) }
function repository(data: unknown = snap()) {
  return { get: vi.fn().mockResolvedValue(data), save: vi.fn().mockResolvedValue(snap({ device: { mode: 'webpush', state: 'pending', binding: 'bind' } })), confirm: vi.fn().mockResolvedValue(undefined) } as never
}
beforeEach(() => {
  permission = 'default'; hasKey = true; subscribe.mockReset().mockResolvedValue(sub); getSubscription.mockReset().mockResolvedValue(null); bind.mockReset(); proof.mockReset()
  vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('ativação de lembretes em um toque', () => {
  it('pede permissão, assina, salva com lembretes ligados e vincula o aparelho', async () => {
    const repo = repository()
    expect(await activateReminders('u', repo, '07:45')).toBe('activated')
    expect((repo as unknown as { save: { mock: { calls: unknown[][] } } }).save.mock.calls[0][1]).toMatchObject({ enabled: true, time: '07:45', permission: 'granted', simulated: false, subscription: { endpoint: 'https://fcm.googleapis.com/x' } })
    expect(bind).toHaveBeenCalledWith('u', 'bind')
  })
  it('reaproveita a assinatura que o navegador já tem', async () => {
    getSubscription.mockResolvedValue(sub)
    await activateReminders('u', repository(), '08:00')
    expect(subscribe).not.toHaveBeenCalled()
  })
  it('sem permissão do leitor não assina nem salva', async () => {
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied') })
    const repo = repository()
    expect(await activateReminders('u', repo, '08:00')).toBe('denied')
    expect((repo as unknown as { save: { mock: { calls: unknown[] } } }).save.mock.calls).toHaveLength(0); expect(subscribe).not.toHaveBeenCalled()
  })
  it('navegador sem suporte ou envio ainda em simulação resulta em indisponível', async () => {
    permission = 'unavailable'
    expect(await activateReminders('u', repository(), '08:00')).toBe('unavailable')
    permission = 'default'
    expect(await activateReminders('u', repository(snap({ mode: 'simulation' })), '08:00')).toBe('unavailable')
  })
  it('confirma o aparelho pendente quando a prova chegou e ignora quando ainda não', async () => {
    const pending = snap({ device: { mode: 'webpush', state: 'pending' } })
    proof.mockResolvedValueOnce({}).mockResolvedValueOnce({ proof: 'p1' })
    const repo = repository(pending)
    expect(await confirmPendingDevice('u', repo)).toBe(false)
    expect(await confirmPendingDevice('u', repo)).toBe(true)
    expect((repo as unknown as { confirm: { mock: { calls: unknown[][] } } }).confirm.mock.calls[0][1]).toBe('p1')
  })
  it('aparelho já ativo conta como confirmado e outros estados não', async () => {
    expect(await confirmPendingDevice('u', repository(snap({ device: { mode: 'webpush', state: 'active' } })))).toBe(true)
    expect(await confirmPendingDevice('u', repository(snap({ device: { mode: 'webpush', state: 'revoked' } })))).toBe(false)
    expect(await confirmPendingDevice('u', repository(snap()))).toBe(false)
  })
})

describe('reativação automática ao abrir o app', () => {
  const enabled = (device: object | null) => snap({ enabled: true, device })
  const real = (state: string) => ({ mode: 'webpush', state, binding: 'bind', time: '07:30', timezone: 'America/Sao_Paulo' })
  const calls = (repo: unknown) => (repo as { save: { mock: { calls: unknown[][] } } }).save.mock.calls
  beforeEach(() => { permission = 'granted' })

  it.each([
    ['permissão não concedida', () => { permission = 'default' }, enabled(real('revoked'))],
    ['sem a chave local (cancelou de propósito ou nunca ativou aqui)', () => { hasKey = false }, enabled(real('revoked'))],
    ['lembretes desligados na conta', () => {}, snap({ enabled: false, device: real('revoked') })],
    ['servidor em simulação', () => {}, enabled(real('revoked')) && { ...enabled(real('revoked')), mode: 'simulation' }],
    ['aparelho fictício', () => {}, enabled({ ...real('revoked'), mode: 'simulation' })],
    ['aparelho inativo sem assinatura', () => {}, enabled(real('inactive'))],
  ])('não faz nada: %s', async (_name, setup, data) => {
    setup()
    const repo = repository(data)
    expect(await rearmReminders('u', repo)).toBe('skipped')
    expect(calls(repo)).toHaveLength(0); expect(subscribe).not.toHaveBeenCalled(); expect(bind).not.toHaveBeenCalled()
  })
  it.each(['active', 'pending'])('aparelho %s é reatado à sessão atual, sem nova assinatura e sem pedir permissão', async state => {
    const repo = repository(enabled(real(state)))
    expect(await rearmReminders('u', repo)).toBe('refreshed')
    expect(calls(repo)[0][1]).toEqual({ enabled: true, time: '07:30', timezone: 'America/Sao_Paulo', permission: 'granted', simulated: false })
    expect(subscribe).not.toHaveBeenCalled()
    expect((globalThis.Notification as unknown as { requestPermission: ReturnType<typeof vi.fn> }).requestPermission).not.toHaveBeenCalled()
    expect(bind).toHaveBeenCalledWith('u', 'bind')
  })
  it.each(['revoked', 'expired'])('aparelho %s (por exemplo depois do Sair) é assinado de novo com o horário de antes', async state => {
    const repo = repository(enabled(real(state)))
    expect(await rearmReminders('u', repo)).toBe('resubscribed')
    expect(subscribe).toHaveBeenCalledOnce()
    expect(calls(repo)[0][1]).toMatchObject({ enabled: true, time: '07:30', permission: 'granted', simulated: false, subscription: { endpoint: 'https://fcm.googleapis.com/x' } })
    expect((globalThis.Notification as unknown as { requestPermission: ReturnType<typeof vi.fn> }).requestPermission).not.toHaveBeenCalled()
    expect(bind).toHaveBeenCalledWith('u', 'bind')
  })
  it('aparelho apagado do servidor, com a chave local ainda presente, é assinado de novo no horário padrão', async () => {
    const repo = repository(enabled(null))
    expect(await rearmReminders('u', repo)).toBe('resubscribed')
    expect(calls(repo)[0][1]).toMatchObject({ time: '08:00', subscription: expect.anything() })
  })
  it('reaproveita a assinatura que o navegador ainda tem', async () => {
    getSubscription.mockResolvedValue(sub)
    await rearmReminders('u', repository(enabled(real('revoked'))))
    expect(subscribe).not.toHaveBeenCalled()
  })
})
