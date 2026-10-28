import { supabase } from '../lib/supabase'
import { createReminderRepository } from './repository'
import { deviceKey, reminderWorker, workerMessage } from './device'
const repository = createReminderRepository(supabase)
let generation = 0
let currentUser: string | null = null
export async function bindReminderDevice(user: string, binding: string) {
  const current = generation
  if (currentUser !== user) return
  await workerMessage('bind', binding)
  if (current !== generation || currentUser !== user) await workerMessage('clear')
}
// Called only on identity/recovery changes, never on a token refresh or focus.
export function synchronizeReminderSession(user: string | null) {
  currentUser = user
  const current = ++generation
  void (async () => {
    await workerMessage('clear')
    if (!user || current !== generation) return
    const key = deviceKey(user)
    if (!key) return
    const state = await repository.get(key)
    if (current !== generation) return
    if (state.enabled && state.device?.mode === 'webpush' && ['active', 'pending'].includes(state.device.state)) {
      await bindReminderDevice(user, state.device.binding)
    }
  })().catch(() => { /* Fail closed: no active binding; settings can retry. */ })
}
export async function disconnectReminderDevice(user: string) {
  generation++
  currentUser = null
  // Start revocation and local clearing independently; failure never blocks logout.
  await Promise.allSettled([
    workerMessage('clear'),
    (async () => { const key = deviceKey(user); if (key) await repository.revoke(key) })(),
    (async () => { const registration = await reminderWorker(); await (await registration?.pushManager.getSubscription())?.unsubscribe() })(),
  ])
}
