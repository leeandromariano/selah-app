import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { deviceKey, reminderWorker, workerMessage } from './device'
import { bindReminderDevice, disconnectReminderDevice, synchronizeReminderSession } from './session'
vi.mock('./device', () => ({ deviceKey: vi.fn(), reminderWorker: vi.fn(), workerMessage: vi.fn() }))
const key = { id: '10000000-0000-4000-8000-000000000001', secret: 'A'.repeat(43) }
describe('isolamento da sessão no service worker', () => {
  it('resposta tardia da conta anterior não reativa seu binding', async () => {
    vi.mocked(workerMessage).mockResolvedValue(null)
    vi.mocked(deviceKey).mockReturnValue(key)
    let resolve!: (value: unknown) => void
    vi.mocked(supabase.rpc).mockReturnValue({ abortSignal: () => new Promise(r => { resolve = r }) } as never)
    synchronizeReminderSession('fiction-a')
    await vi.waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('get_my_reminders', expect.anything()))
    synchronizeReminderSession(null)
    resolve({ data: { enabled: true, mode: 'webpush', device: { time: '08:00', binding: 'old-binding', state: 'active', mode: 'webpush' } }, error: null })
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(workerMessage).not.toHaveBeenCalledWith('bind', 'old-binding')
  })
  it('logout limpa binding e tenta revogar mesmo com erro de unsubscribe', async () => {
    vi.mocked(workerMessage).mockResolvedValue(null)
    vi.mocked(deviceKey).mockReturnValue(key)
    vi.mocked(reminderWorker).mockRejectedValue(Error('unavailable'))
    vi.mocked(supabase.rpc).mockReturnValue({ abortSignal: async () => ({ data: null, error: null }) } as never)
    await expect(disconnectReminderDevice('fiction-a')).resolves.toBeUndefined()
    expect(workerMessage).toHaveBeenCalledWith('clear')
    expect(supabase.rpc).toHaveBeenCalledWith('revoke_my_push_device', { p_device: key.id, p_secret: key.secret })
    await bindReminderDevice('fiction-a', 'stale')
    expect(workerMessage).not.toHaveBeenCalledWith('bind', 'stale')
  })
})
