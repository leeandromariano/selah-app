/* No fetch handler or content caching: authentication remains in the app. */
importScripts('/push-protocol.js')
function store(operation, value) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('selah-reminder-binding', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('state')
    open.onerror = () => reject(Error('Storage unavailable'))
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction('state', operation === 'get' ? 'readonly' : 'readwrite')
      const request = operation === 'get' ? tx.objectStore('state').get('current') : tx.objectStore('state').put(value, 'current')
      tx.oncomplete = () => { db.close(); resolve(request.result) }
      tx.onerror = () => { db.close(); reject(Error('Storage unavailable')) }
    }
  })
}
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()))
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('message', event => {
  if (!event.source?.url || new URL(event.source.url).origin !== self.location.origin) return
  event.waitUntil((async () => {
    try {
      const data = event.data
      if (data?.type === 'bind' && /^[0-9a-f-]{36}$/i.test(data.binding || '')) await store('put', { binding: data.binding })
      else if (data?.type === 'clear') {
        await store('put', null)
        for (const item of await self.registration.getNotifications()) item.close()
      } else if (data?.type !== 'proof') return
      event.ports[0]?.postMessage({ ok: true, proof: data.type === 'proof' ? (await store('get'))?.proof : undefined })
    } catch { event.ports[0]?.postMessage({ ok: false }) }
  })())
})
self.addEventListener('push', event => event.waitUntil((async () => {
  let payload
  try { payload = event.data?.json() } catch { return }
  const state = await store('get')
  const message = SelahPush.notification(payload, state?.binding)
  if (!message) return
  if (message.proof) await store('put', { ...state, proof: message.proof })
  await self.registration.showNotification(message.title, {
    body: message.body, tag: 'selah-' + (payload.day || 'activation'),
    data: { path: message.path, binding: state.binding },
  })
})()))
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const { path, binding } = event.notification.data || {}
    if ((await store('get'))?.binding !== binding || !SelahPush.safePath(path)) return
    const url = new URL(path, self.location.origin).href
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) { await client.navigate(url); await client.focus(); return }
    }
    await self.clients.openWindow(url)
  })())
})
self.addEventListener('pushsubscriptionchange', event => event.waitUntil(store('put', null)))
