// Transport boundary: this module never opens a network connection.
export async function runReminderBatch({ repository, transport, now = () => new Date() }) {
  const results = []
  for (const id of await repository.claim(now().toISOString())) {
    const job = await repository.prepare(id, now().toISOString())
    if (!job) continue
    let outcome
    try {
      if (job.mode !== transport.mode) outcome = 'failed'
      else { await transport.send(job); outcome = transport.mode === 'simulation' ? 'simulated' : 'accepted' }
    } catch (error) {
      outcome = [404, 410].includes(error?.statusCode) ? 'expired'
        : Number.isInteger(error?.statusCode) ? 'failed' : 'uncertain'
    }
    // No retry: a timeout may mean that the provider accepted the message.
    await repository.finish(id, outcome)
    results.push({ id, outcome })
  }
  return results
}
export function simulationTransport() {
  const intents = []
  return { mode: 'simulation', intents, async send(job) {
    intents.push({ job: job.job, payload: structuredClone(job.payload) })
  } }
}
