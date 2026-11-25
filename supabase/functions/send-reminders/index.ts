import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import webpush from 'npm:web-push@3.6.7'
import { hostedLoginEnvironment } from '../_shared/password-login.ts'
import { createFetchTransport, runSchedulerCycle, transportSelfTest } from '../_shared/reminder-scheduler.ts'
import type { WebPushLib } from '../_shared/reminder-scheduler.ts'

// Agendador de lembretes por push. Quem chama é o próprio banco (pg_cron + pg_net), a cada minuto, com um segredo do Vault no
// cabeçalho x-scheduler-secret. Só roda em projeto Supabase hospedado. A chave de serviço do runtime só alcança as funções
// scheduler_* (executáveis apenas por service_role). Respostas e logs só têm contagens: nunca endpoint, usuário ou conteúdo.
const json = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const unavailable = () => json({ error: 'unavailable' }, 503)

try {
  const config = hostedLoginEnvironment(Deno.env.get('SUPABASE_URL'))
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const vapid = { publicKey: Deno.env.get('SELAH_VAPID_PUBLIC_KEY'), privateKey: Deno.env.get('SELAH_VAPID_PRIVATE_KEY'), subject: Deno.env.get('SELAH_VAPID_SUBJECT') }
  if (!serviceKey) throw Error('Hosted runtime unavailable')
  const admin = createClient(config.api, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
        if (url.origin !== config.api || url.username || url.password || url.hash || !url.pathname.startsWith('/rest/v1/rpc/scheduler_')) throw Error('Unsupported request')
        return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) })
      },
    },
  })
  const rpc = async (name: string, args: Record<string, unknown> = {}) => {
    const { data, error } = await admin.rpc(name, args)
    if (error) throw Error('Scheduler RPC failed')
    return data as unknown
  }
  const lib = webpush as unknown as WebPushLib
  Deno.serve(async request => {
    try {
      if (request.method !== 'POST') return json({ error: 'method' }, 405)
      if (await rpc('scheduler_check_secret', { p_secret: request.headers.get('x-scheduler-secret') }) !== true) return json({ error: 'forbidden' }, 403)
      const body = await request.json().catch(() => ({})) as { selfTest?: unknown }
      // Autoteste: prova a criptografia e a assinatura VAPID neste runtime, sem rede e sem tocar em nenhum aparelho.
      if (body?.selfTest === true) return json(await transportSelfTest(lib, vapid))
      const transport = createFetchTransport({ lib, ...vapid })
      return json(await runSchedulerCycle({ rpc, transport, publicKey: vapid.publicKey ?? '' }))
    } catch { return unavailable() }
  })
} catch {
  Deno.serve(unavailable)
}
