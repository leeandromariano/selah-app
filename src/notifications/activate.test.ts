import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let permission = 'default'
const subscribe = vi.fn(), getSubscription = vi.fn(), bind = vi.fn(), proof = vi.fn()
vi.mock('./device', () => ({
  deviceKey: (_user: string, create = false) => create ? { id: 'id', secret: 's' } : { id: 'id', secret: 's' },
  notificationPermission: () => permission,
  reminderWorker: async () => ({ pushManager: { getSubscription, subscribe } }),
  workerMessage: (...args: unknown[]) => proof(...args),
}))
vi.mock('./session', () => ({ bindReminderDevice: (...args: unknown[]) => bind(...args) }))
import { activateReminders, confirmPendingDevice } from './activate'

const vapid = 'B'.repeat(87)
const snap = (over: object = {}) => ({ enabled: false, mode: 'webpush', vapid_public_key: vapid, device: null, last: null, ...over })
const sub = { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/x', keys: {} }) }
function repository(data: unknown = snap()) {
  return { get: vi.fn().mockResolvedValue(data), save: vi.fn().mockResolvedValue(snap({ device: { mode: 'webpush', state: 'pending', binding: 'bind' } })), confirm: vi.fn().mockResolvedValue(undefined) } as never
}
beforeEach(() => {
  permission = 'default'; subscribe.mockReset().mockResolvedValue(sub); getSubscription.mockReset().mockResolvedValue(null); bind.mockReset(); proof.mockReset()
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
