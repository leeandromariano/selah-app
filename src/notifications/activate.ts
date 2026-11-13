import type { createReminderRepository } from './repository'
import { deviceKey, notificationPermission, reminderWorker, workerMessage } from './device'
import { bindReminderDevice } from './session'

type Repository = Pick<ReturnType<typeof createReminderRepository>, 'get' | 'save' | 'confirm'>
export type ActivationResult = 'activated' | 'denied' | 'unavailable'

// Ativação em um toque: permissão do navegador, assinatura push, preferências e vínculo do dispositivo.
// A permissão só é pedida aqui, a partir de um clique do leitor.
export async function activateReminders(user: string, repository: Repository, time: string): Promise<ActivationResult> {
  if (notificationPermission() === 'unavailable') return 'unavailable'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  const snapshot = await repository.get(deviceKey(user))
  if (snapshot.mode !== 'webpush' || !snapshot.vapid_public_key) return 'unavailable'
  const registration = await reminderWorker(true)
  if (!registration) return 'unavailable'
  const bytes = Uint8Array.from(atob(snapshot.vapid_public_key.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
  const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
  const data = await repository.save(deviceKey(user, true)!, {
    enabled: true, time, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    permission: 'granted', simulated: false, subscription: subscription.toJSON(),
  })
  if (data.device?.mode === 'webpush' && ['active', 'pending'].includes(data.device.state)) await bindReminderDevice(user, data.device.binding)
  return 'activated'
}

// Conclui sozinho a confirmação do aparelho assim que a mensagem de verificação chega (sem o leitor voltar às Configurações).
// Retorna true quando o aparelho está ativo.
export async function confirmPendingDevice(user: string, repository: Repository): Promise<boolean> {
  const key = deviceKey(user)
  if (!key) return false
  const snapshot = await repository.get(key)
  if (snapshot.device?.mode !== 'webpush') return false
  if (snapshot.device.state === 'active') return true
  if (snapshot.device.state !== 'pending') return false
  const result = await workerMessage('proof')
  if (!result?.proof) return false
  await repository.confirm(key, result.proof)
  return true
}
