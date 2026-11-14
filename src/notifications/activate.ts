import type { createReminderRepository } from './repository'
import { deviceKey, notificationPermission, reminderWorker, workerMessage } from './device'
import { bindReminderDevice } from './session'

type Repository = Pick<ReturnType<typeof createReminderRepository>, 'get' | 'save' | 'confirm'>
export type ActivationResult = 'activated' | 'denied' | 'unavailable'
export type RearmResult = 'skipped' | 'refreshed' | 'resubscribed'

async function browserSubscription(vapidPublicKey: string) {
  const registration = await reminderWorker(true)
  if (!registration) return null
  const bytes = Uint8Array.from(atob(vapidPublicKey.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
  return await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
}

// Ativação em um toque: permissão do navegador, assinatura push, preferências e vínculo do dispositivo.
// A permissão só é pedida aqui, a partir de um clique do leitor.
export async function activateReminders(user: string, repository: Repository, time: string): Promise<ActivationResult> {
  if (notificationPermission() === 'unavailable') return 'unavailable'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  const snapshot = await repository.get(deviceKey(user))
  if (snapshot.mode !== 'webpush' || !snapshot.vapid_public_key) return 'unavailable'
  const subscription = await browserSubscription(snapshot.vapid_public_key)
  if (!subscription) return 'unavailable'
  const data = await repository.save(deviceKey(user, true)!, {
    enabled: true, time, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    permission: 'granted', simulated: false, subscription: subscription.toJSON(),
  })
  if (data.device?.mode === 'webpush' && ['active', 'pending'].includes(data.device.state)) await bindReminderDevice(user, data.device.binding)
  return 'activated'
}

// Reativação automática ao abrir o app, SEM pedir nada: só restaura o que a pessoa já escolheu. Exige, ao mesmo tempo:
// lembretes ligados na conta, permissão do navegador já concedida e a chave local deste aparelho (ela some se a pessoa
// cancelar a assinatura de propósito, e então nada é reativado). Aparelho ativo ou pendente é reatado à sessão atual
// (o servidor só envia para sessão válida); aparelho revogado pelo Sair, expirado ou apagado é assinado de novo.
export async function rearmReminders(user: string, repository: Repository): Promise<RearmResult> {
  if (notificationPermission() !== 'granted') return 'skipped'
  const key = deviceKey(user)
  if (!key) return 'skipped'
  const snapshot = await repository.get(key)
  if (!snapshot.enabled || snapshot.mode !== 'webpush' || !snapshot.vapid_public_key) return 'skipped'
  const device = snapshot.device
  if (device && device.mode !== 'webpush') return 'skipped'
  const time = device?.time ?? '08:00'
  const timezone = device?.timezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  if (device && ['active', 'pending'].includes(device.state)) {
    const data = await repository.save(key, { enabled: true, time, timezone, permission: 'granted', simulated: false })
    if (data.device?.mode === 'webpush' && ['active', 'pending'].includes(data.device.state)) await bindReminderDevice(user, data.device.binding)
    return 'refreshed'
  }
  if (device && !['revoked', 'expired'].includes(device.state)) return 'skipped'
  const subscription = await browserSubscription(snapshot.vapid_public_key)
  if (!subscription) return 'skipped'
  const data = await repository.save(key, { enabled: true, time, timezone, permission: 'granted', simulated: false, subscription: subscription.toJSON() })
  if (data.device?.mode === 'webpush' && ['active', 'pending'].includes(data.device.state)) await bindReminderDevice(user, data.device.binding)
  return 'resubscribed'
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
