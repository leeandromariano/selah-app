import pg from 'pg'
import { runReminderBatch } from './reminder-worker-core.mjs'
import { createWebPushTransport } from './reminder-webpush-transport.mjs'
import { createHostedRepository, runHostedCycle } from './hosted-reminder-repository.mjs'

// Executado pelo GitHub Actions (.github/workflows/reminders.yml). Um ciclo por execução.
// Segredos vêm só do ambiente; nada de endpoint, usuário ou conteúdo vai para o log.
const { SELAH_DATABASE_URL, SELAH_DATABASE_CA, SELAH_VAPID_PUBLIC_KEY, SELAH_VAPID_PRIVATE_KEY, SELAH_VAPID_SUBJECT } = process.env
if (!SELAH_DATABASE_URL) throw Error('SELAH_DATABASE_URL ausente')
const transport = createWebPushTransport({ authorized: true, publicKey: SELAH_VAPID_PUBLIC_KEY, privateKey: SELAH_VAPID_PRIVATE_KEY, subject: SELAH_VAPID_SUBJECT })
// Verificação TLS sempre ligada. Se o certificado do Supabase não estiver no repositório de confiança do runner,
// informe o certificado de CA (PEM) em SELAH_DATABASE_CA.
const db = new pg.Client({ connectionString: SELAH_DATABASE_URL, ssl: SELAH_DATABASE_CA ? { ca: SELAH_DATABASE_CA } : true })
await db.connect()
try {
  const result = await runHostedCycle({ repository: createHostedRepository(db), transport, publicKey: SELAH_VAPID_PUBLIC_KEY, runBatch: runReminderBatch })
  console.log(JSON.stringify(result))
} finally { await db.end() }
