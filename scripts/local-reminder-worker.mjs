import { prepareLocalScript } from './local-environment.mjs'
import { runReminderBatch, simulationTransport } from './reminder-worker-core.mjs'
import { createWebPushTransport } from './reminder-webpush-transport.mjs'

// Local postgres socket only; no browser or hosted scheduler dependency.
const local = prepareLocalScript()
const args = process.argv.slice(2)
if (args.some(arg => !['--once', '--watch', '--check-local', '--real'].includes(arg))) throw Error('Invalid local worker arguments')
const real = args.includes('--real')
if (real && process.env.SELAH_EXTERNAL_PUSH_AUTHORIZATION !== 'EXPLICIT_AUTHORIZATION_OBTAINED') throw Error('Real push blocked: specific authorization required')
const literal = value => "'" + String(value).replaceAll("'", "''") + "'"
function query(sql) {
  const output = local.psql('\\pset tuples_only on\n\\pset format unaligned\n' + sql)
  try { return output.split(/\r?\n/).map(s => s.trim()).filter(s => s.startsWith('{') || s.startsWith('[') || s === 'null').map(s => JSON.parse(s))[0] }
  catch { throw Error('Invalid local scheduler response') }
}
const repository = {
  async claim(now) { return query(`select coalesce(json_agg(id),'[]') from private.claim_reminders(${literal(now)}::timestamptz,100,${literal(real ? 'webpush' : 'simulation')}) id;`) },
  async prepare(id, now) { return query(`select private.prepare_reminder(${literal(id)}::uuid,${literal(now)}::timestamptz);`) },
  async finish(id, outcome) { local.psql(`select private.finish_reminder(${literal(id)}::uuid,${literal(outcome)});`) },
}
async function tick() {
  const transport = real ? createWebPushTransport({ authorized: true,
    publicKey: process.env.SELAH_VAPID_PUBLIC_KEY, privateKey: process.env.SELAH_VAPID_PRIVATE_KEY, subject: process.env.SELAH_VAPID_SUBJECT,
  }) : simulationTransport()
  if (real) {
    const configuration = query('select row_to_json(c) from private.push_configuration c;')
    if (configuration?.mode !== 'webpush' || configuration.vapid_public_key !== process.env.SELAH_VAPID_PUBLIC_KEY) throw Error('Server public VAPID configuration differs')
    const proofs = query('select coalesce(json_agg(p),\'[]\') from private.claim_push_proofs() p;')
    for (const proof of proofs) {
      try { await transport.send(proof) } catch { /* No blind retry of encrypted enrollment proof. Expires in 10 minutes. */ }
    }
  }
  const results = await runReminderBatch({ repository, transport })
  // No endpoints, credentials, user IDs or payloads in operational logs.
  console.log(JSON.stringify({ simulation: !real, attempts: results.length, recorded: transport.intents?.length ?? 0 }))
  local.psql('select private.cleanup_reminders();')
}
if (!args.includes('--check-local')) {
  let running = false
  const cycle = async () => {
    if (running) return
    running = true
    try { await tick() } finally { running = false }
  }
  await cycle()
  if (args.includes('--watch')) setInterval(() => cycle().catch(() => console.error('Local reminder cycle failed')), 60000)
}
