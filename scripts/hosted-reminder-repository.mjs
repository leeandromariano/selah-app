// Repositório do agendador no banco hospedado. Recebe um cliente com query(text, values) (pg) e só chama as
// funções do schema private, com parâmetros (nada é concatenado em SQL).
export function createHostedRepository(db) {
  const rows = async (text, values = []) => (await db.query(text, values)).rows
  return {
    async configuration() {
      return (await rows('select mode, vapid_public_key from private.push_configuration limit 1'))[0] ?? null
    },
    async claim(now) {
      return (await rows('select id from private.claim_reminders($1::timestamptz, 100, $2) id', [now, 'webpush'])).map(r => r.id)
    },
    async prepare(id, now) {
      return (await rows('select private.prepare_reminder($1::uuid, $2::timestamptz) as job', [id, now]))[0]?.job ?? null
    },
    async finish(id, outcome) { await db.query('select private.finish_reminder($1::uuid, $2)', [id, outcome]) },
    // Avisos de devocional nova: mesmo ciclo, outras funções do banco.
    notices: {
      async claim(now) {
        return (await rows('select id from private.claim_publish_notices($1::timestamptz, 100, $2) id', [now, 'webpush'])).map(r => r.id)
      },
      async prepare(id, now) {
        return (await rows('select private.prepare_publish_notice($1::uuid, $2::timestamptz) as job', [id, now]))[0]?.job ?? null
      },
      async finish(id, outcome) { await db.query('select private.finish_publish_notice($1::uuid, $2)', [id, outcome]) },
    },
    async proofs() { return (await rows('select p from private.claim_push_proofs() p')).map(r => r.p) },
    async cleanup() { await db.query('select private.cleanup_reminders()') },
  }
}

// Um ciclo: só envia de verdade se o banco estiver em modo webpush e com a mesma chave pública do servidor.
export async function runHostedCycle({ repository, transport, publicKey, runBatch }) {
  const configuration = await repository.configuration()
  if (configuration?.mode !== 'webpush') return { skipped: 'banco em modo de simulação' }
  if (configuration.vapid_public_key !== publicKey) throw Error('Server public VAPID configuration differs')
  for (const proof of await repository.proofs()) {
    try { await transport.send(proof) } catch { /* sem nova tentativa: a prova expira em 10 minutos */ }
  }
  const results = await runBatch({ repository, transport })
  const notices = repository.notices ? await runBatch({ repository: repository.notices, transport }) : []
  await repository.cleanup()
  return { attempts: results.length, accepted: results.filter(r => r.outcome === 'accepted').length, notices: notices.length, noticesAccepted: notices.filter(r => r.outcome === 'accepted').length }
}
