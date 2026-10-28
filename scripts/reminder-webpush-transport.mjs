import webpush from 'web-push'
// Server-only adapter. The local CLI invokes it only in explicitly gated --real mode.
// Installation and constructing this adapter perform no external sends.
export function createWebPushTransport({ authorized = false, publicKey, privateKey, subject }) {
  if (!authorized) throw Error('Real push requires specific operator authorization')
  if (!/^[A-Za-z0-9_-]{87}$/.test(publicKey ?? '') || !/^[A-Za-z0-9_-]{43}$/.test(privateKey ?? '')
    || !/^mailto:[^\s]+@[^\s]+$/.test(subject ?? '')) throw Error('Server VAPID configuration required')
  return { mode: 'webpush', async send(job) {
    // Library performs RFC 8291 encryption and VAPID signing, no secrets in payload.
    await webpush.sendNotification(job.subscription, JSON.stringify(job.payload), {
      vapidDetails: { subject, publicKey, privateKey }, TTL: 600, timeout: 10000,
    })
  } }
}
