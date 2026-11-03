// Local, optional UI preference. This never records content or credentials.
export async function positionKey(userId: string, devotionalId: string, environment: string): Promise<string | null> {
  try {
    if (!userId || !devotionalId || !globalThis.crypto?.subtle) return null
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${environment}\0${userId}`))
    const account = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    return `selah.reading-position.v1:${account}:${encodeURIComponent(devotionalId)}`
  } catch { return null }
}

export function readPosition(key: string, revision: number): { ratio: number | null; stale: boolean } {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { ratio: null, stale: false }
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return { ratio: null, stale: false }
    const saved = value as { revision?: unknown; ratio?: unknown }
    if (!Number.isSafeInteger(saved.revision) || typeof saved.ratio !== 'number' || !Number.isFinite(saved.ratio) || saved.ratio < 0 || saved.ratio > 1) return { ratio: null, stale: false }
    if (saved.revision !== revision) return { ratio: null, stale: true }
    return { ratio: saved.ratio, stale: false }
  } catch { return { ratio: null, stale: false } }
}

export function savePosition(key: string, revision: number, ratio: number): void {
  if (!Number.isSafeInteger(revision) || revision < 1 || !Number.isFinite(ratio)) return
  try { localStorage.setItem(key, JSON.stringify({ revision, ratio: Math.max(0, Math.min(1, ratio)) })) } catch { /* Reading remains available without storage. */ }
}
