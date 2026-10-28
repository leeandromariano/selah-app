import type { DeviceKey } from './repository'
const prefix = 'selah.reminder.device.'
export function deviceKey(user: string, create = false): DeviceKey | null {
  try {
    const saved = localStorage.getItem(prefix + user)
    if (saved) {
      const key = JSON.parse(saved) as DeviceKey
      if (/^[0-9a-f-]{36}$/i.test(key.id) && /^[A-Za-z0-9_-]{43}$/.test(key.secret)) return key
    }
    if (!create) return null
    const key = { id: crypto.randomUUID(), secret: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '') }
    localStorage.setItem(prefix + user, JSON.stringify(key))
    return key
  } catch { if (create) throw Error('O armazenamento do dispositivo está indisponível. Os lembretes não foram ativados.'); return null }
}
export function notificationPermission() {
  return typeof Notification === 'undefined' || !globalThis.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in globalThis)
    ? 'unavailable' : Notification.permission
}
export async function reminderWorker(create = false) {
  if (!('serviceWorker' in navigator)) return null
  let registration = await navigator.serviceWorker.getRegistration('/')
  if (registration && ![registration.active, registration.waiting, registration.installing].some(w => w?.scriptURL === new URL('/selah-sw.js', location.origin).href)) throw Error('Outro service worker utiliza este endereço.')
  if (!registration && create) registration = await navigator.serviceWorker.register('/selah-sw.js', { scope: '/' })
  if (!registration) return null
  if (!registration.active) {
    await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(Error('O serviço de lembretes ainda não está pronto.')), 8000))])
  }
  return registration
}
export async function workerMessage(type: 'clear' | 'bind' | 'proof', binding?: string) {
  const registration = await reminderWorker(type === 'bind')
  if (!registration?.active) return null
  return new Promise<{ proof?: string }>((resolve, reject) => {
    const channel = new MessageChannel()
    const timeout = setTimeout(() => { channel.port1.close(); reject(Error('O serviço de lembretes não respondeu.')) }, 5000)
    channel.port1.onmessage = event => {
      clearTimeout(timeout); channel.port1.close()
      if (event.data?.ok) resolve(event.data); else reject(Error('Não foi possível atualizar este dispositivo.'))
    }
    registration.active!.postMessage({ type, binding }, [channel.port2])
  })
}
