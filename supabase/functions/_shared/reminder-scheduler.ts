// Núcleo do agendador de lembretes: independente de runtime (testado no Vitest; a Edge Function só injeta Deno/npm).
// Mantém as regras do worker em Node: nunca repete envio (um timeout pode ter sido aceito) e nunca registra endpoint, usuário ou conteúdo.
export type Rpc = (name: string, args?: Record<string, unknown>) => Promise<unknown>
export type PushJob = { job?: string; mode?: string; subscription: { endpoint: string; keys: { p256dh: string; auth: string } }; payload: Record<string, unknown> }
export type Transport = { send(job: PushJob): Promise<void> }
export type Outcome = 'accepted' | 'failed' | 'expired' | 'uncertain'
export type WebPushLib = {
  generateRequestDetails(subscription: unknown, payload: string, options: unknown): { endpoint: string; method: string; headers: Record<string, string>; body: Uint8Array | null }
}

export function outcomeOf(error: unknown): Outcome {
  const status = (error as { statusCode?: unknown })?.statusCode
  if (status === 404 || status === 410) return 'expired'
  return Number.isInteger(status) ? 'failed' : 'uncertain'
}

export async function runBatch({ ids, prepare, finish, transport }: {
  ids: string[]; prepare: (id: string) => Promise<PushJob | null>; finish: (id: string, outcome: Outcome) => Promise<void>; transport: Transport
}) {
  const results: { id: string; outcome: Outcome }[] = []
  for (const id of ids) {
    const job = await prepare(id)
    if (!job) continue
    let outcome: Outcome
    try {
      if (job.mode !== 'webpush') outcome = 'failed'
      else { await transport.send(job); outcome = 'accepted' }
    } catch (error) { outcome = outcomeOf(error) }
    // Sem nova tentativa: um timeout pode significar que o provedor aceitou a mensagem.
    await finish(id, outcome)
    results.push({ id, outcome })
  }
  return results
}

export function createFetchTransport({ lib, publicKey, privateKey, subject, fetchImpl = fetch }: {
  lib: WebPushLib; publicKey?: string; privateKey?: string; subject?: string; fetchImpl?: typeof fetch
}): Transport {
  if (!/^[A-Za-z0-9_-]{87}$/.test(publicKey ?? '') || !/^[A-Za-z0-9_-]{43}$/.test(privateKey ?? '') || !/^mailto:[^\s]+@[^\s]+$/.test(subject ?? '')) throw Error('Server VAPID configuration required')
  return {
    async send(job) {
      // A biblioteca só criptografa (RFC 8291) e assina (VAPID); quem envia é o fetch, com tempo limite e sem seguir redirecionamentos.
      const details = lib.generateRequestDetails(job.subscription, JSON.stringify(job.payload), { vapidDetails: { subject, publicKey, privateKey }, TTL: 600 })
      const headers = Object.fromEntries(Object.entries(details.headers).filter(([name]) => name.toLowerCase() !== 'content-length'))
      const response = await fetchImpl(details.endpoint, { method: details.method, headers, body: (details.body ?? undefined) as BodyInit | undefined, redirect: 'error', signal: AbortSignal.timeout(10000) })
      await response.body?.cancel()
      if (!response.ok) throw Object.assign(Error('Push rejected'), { statusCode: response.status })
    },
  }
}

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

// Assinatura de mentira (par de chaves P-256 e segredo de autenticação gerados na hora) para provar, sem rede, que a criptografia
// e a assinatura VAPID funcionam neste runtime. Não envia nada.
export async function transportSelfTest(lib: WebPushLib, config: { publicKey?: string; privateKey?: string; subject?: string }) {
  try {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const p256dh = base64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)))
    const auth = base64url(crypto.getRandomValues(new Uint8Array(16)))
    const details = lib.generateRequestDetails({ endpoint: 'https://push.invalid/selftest', keys: { p256dh, auth } }, JSON.stringify({ v: 1, kind: 'selftest' }),
      { vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey }, TTL: 600 })
    const headers = Object.fromEntries(Object.entries(details.headers).map(([name, value]) => [name.toLowerCase(), value]))
    const ok = details.method === 'POST' && (details.body?.byteLength ?? 0) > 0 && headers['content-encoding'] === 'aes128gcm' && /^vapid t=/.test(headers['authorization'] ?? '')
    return { selfTest: ok ? 'ok' : 'falhou' }
  } catch { return { selfTest: 'falhou' } }
}

// Um ciclo completo. Só envia de verdade se o banco estiver em modo webpush e com a mesma chave pública VAPID do servidor.
export async function runSchedulerCycle({ rpc, transport, publicKey, now = () => new Date() }: {
  rpc: Rpc; transport: Transport; publicKey: string; now?: () => Date
}) {
  const config = await rpc('scheduler_config') as { mode?: string; vapid_public_key?: string | null } | null
  if (config?.mode !== 'webpush') return { skipped: 'banco em modo de simulação' }
  if (config.vapid_public_key !== publicKey) throw Error('Server public VAPID configuration differs')
  const proofs = (await rpc('scheduler_claim_proofs') as PushJob[] | null) ?? []
  for (const proof of proofs) {
    try { await transport.send(proof) } catch { /* sem nova tentativa: a prova expira em 10 minutos */ }
  }
  const stamp = () => now().toISOString()
  const ids = async (name: string) => ((await rpc(name, { p_now: stamp() })) as string[] | null) ?? []
  const reminders = await runBatch({
    ids: await ids('scheduler_claim_reminders'), transport,
    prepare: async id => await rpc('scheduler_prepare_reminder', { p_id: id, p_now: stamp() }) as PushJob | null,
    finish: async (id, outcome) => { await rpc('scheduler_finish_reminder', { p_id: id, p_result: outcome }) },
  })
  const notices = await runBatch({
    ids: await ids('scheduler_claim_notices'), transport,
    prepare: async id => await rpc('scheduler_prepare_notice', { p_id: id, p_now: stamp() }) as PushJob | null,
    finish: async (id, outcome) => { await rpc('scheduler_finish_notice', { p_id: id, p_result: outcome }) },
  })
  await rpc('scheduler_cleanup')
  const accepted = (items: { outcome: Outcome }[]) => items.filter(item => item.outcome === 'accepted').length
  return { proofs: proofs.length, attempts: reminders.length, accepted: accepted(reminders), notices: notices.length, noticesAccepted: accepted(notices) }
}
