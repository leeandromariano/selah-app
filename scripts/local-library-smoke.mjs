import { prepareLocalScript, localUrl } from './local-environment.mjs'
// Explicit local integration. SQL is used only to insert synthetic content fixtures.
// Normal reader operations below exclusively use the public API and reader sessions.
import { randomUUID } from 'node:crypto'
import { createDevotionalRepository, localDay, publishedToday } from '../src/devotionals/repository.ts'

const local = prepareLocalScript()
const { mail } = local
const makeClient = () => local.client()
let passed = 0
let stage = 'synthetic account setup'
function check(ok, label) { stage = label; if (!ok) throw new Error('check failed'); passed++; console.log(`PASS ${label}`) }

async function request(url, options) { return local.fetch(url, options) }
async function reader() {
  const client = makeClient()
  const email = `selah-library-${randomUUID()}@example.invalid`
  const password = `Fiction-${randomUUID()}!`
  const signup = await client.auth.signUp({ email, password, options: { emailRedirectTo: 'http://127.0.0.1:5173', data: { username: 'u' + randomUUID().replaceAll('-', '').slice(0,20) } } })
  check(!signup.error && signup.data.user && !signup.data.session, 'synthetic reader created with confirmation required')
  let link
  for (let attempt = 0; attempt < 20 && !link; attempt++) {
    const list = await (await request(`${mail}/api/v1/messages`)).json()
    const message = list.messages?.find(m => m.To?.some(to => to.Address === email))
    if (message) {
      const detail = await (await request(`${mail}/api/v1/message/${message.ID}`)).json()
      link = ((detail.Text || detail.HTML).match(/https?:\/\/[^\s"<>]+/g) || []).map(s => s.replaceAll('&amp;', '&')).find(s => s.includes('/auth/v1/verify?'))
    }
    if (!link) await new Promise(resolve => setTimeout(resolve, 500))
  }
  check(Boolean(link), 'confirmation received in local Mailpit')
  const response = await request(link)
  const tokens = new URLSearchParams(localUrl(response.headers.get('location'), 'frontend').hash.slice(1))
  const verified = await client.auth.setSession({ access_token: tokens.get('access_token'), refresh_token: tokens.get('refresh_token') })
  check(!verified.error, 'synthetic reader authenticated')
  return { client, email, password, id: signup.data.user.id, repository: createDevotionalRepository(client) }
}
try {
  const first = await reader()
  const second = await reader()
  const ids = Array.from({ length: 5 }, () => randomUUID())
  stage = 'local synthetic content setup'
  // All interpolated IDs originate in crypto.randomUUID/Auth and are checked as UUIDs.
  if (![first.id, ...ids].every(value => /^[0-9a-f-]{36}$/.test(value))) throw new Error('Invalid fixture UUID')
  const fixtures = `begin;
    insert into public.devotionals (id,title,bible_reference,bible_text,content,reflection_question,publish_at,status,author_id) values
    ('${ids[0]}','Devocional fictício do dia','Referência fictícia','Texto bíblico fictício','Reflexão fictícia para testes locais.','Pergunta fictícia?',now(),'published','${first.id}'),
    ('${ids[1]}','Devocional fictício anterior','Referência fictícia','Texto bíblico fictício','Reflexão fictícia anterior.','Pergunta fictícia?',now()-interval '1 day','published','${first.id}'),
    ('${ids[2]}','Rascunho fictício','Referência fictícia','Texto fictício','Conteúdo fictício','Pergunta?',null,'draft','${first.id}'),
    ('${ids[3]}','Agendado fictício','Referência fictícia','Texto fictício','Conteúdo fictício','Pergunta?',now()-interval '1 day','scheduled','${first.id}'),
    ('${ids[4]}','Publicado futuro fictício','Referência fictícia','Texto fictício','Conteúdo fictício','Pergunta?',now()+interval '1 day','published','${first.id}'); commit;`
  const seeded = local.psql(fixtures)
  check(seeded.includes('INSERT 0 5'), 'five synthetic content fixtures inserted locally without schema changes')
  const now = new Date()
  const published = await first.repository.published(now)
  const ownFixture = published.filter(item => ids.includes(item.id))
  check(ownFixture.length === 2 && ownFixture[0].id === ids[0] && ownFixture[1].id === ids[1], 'reader repository returns only eligible publications in date order')
  check(!('author_id' in ownFixture[0]) && !('status' in ownFixture[0]), 'reader projection omits administrative columns')
  check(publishedToday(ownFixture, now)?.id === ids[0] && localDay(ownFixture[1].publish_at) < localDay(now), 'day and previous archive use Sao Paulo calendar')
  for (const hidden of ids.slice(2)) {
    const result = await first.client.from('devotionals').select('id').eq('id', hidden)
    check(!result.error && result.data.length === 0, 'direct API hides draft, scheduled or future publication')
    const denied = await first.client.from('devotional_views').insert({ devotional_id: hidden })
    check(denied.error?.code === '42501', 'opening unpublished content denied')
  }
  const injected = await first.client.from('devotionals').insert({ title: 'Tentativa fictícia', bible_reference: 'Ref', bible_text: 'Texto', content: 'Texto', reflection_question: 'Pergunta', author_id: first.id })
  check(injected.error?.code === '42501', 'reader cannot create content')
  const update = await first.client.from('devotionals').update({ status: 'published', publish_at: now.toISOString() }).eq('id', ids[2]).select('id')
  check(!update.error && update.data.length === 0, 'reader cannot publish draft')
  const firstEvent = await first.repository.open(ids[0])
  await first.repository.open(ids[0])
  check(firstEvent.devotional_id === ids[0] && Boolean(firstEvent.opened_at), 'server records reader opening and timestamp')
  check(!('completed_at' in firstEvent), 'opening is not represented as completion')
  const secondHistory = await second.repository.openings(second.id)
  check(secondHistory.length === 0, 'other reader cannot see first reader history')
  const direct = await second.client.from('devotional_views').select('*').eq('user_id', first.id)
  check(!direct.error && direct.data.length === 0, 'direct API hides another reader events')
  const forged = await second.client.from('devotional_views').insert({ devotional_id: ids[0], user_id: first.id })
  check(forged.error?.code === '42501', 'forged event ownership denied')
  const forgedTime = await first.client.from('devotional_views').insert({ devotional_id: ids[0], opened_at: now.toISOString() })
  check(forgedTime.error?.code === '42501', 'forged event timestamp denied')
  const altered = await first.client.from('devotional_views').update({ opened_at: now.toISOString() }).eq('id', firstEvent.id)
  check(altered.error?.code === '42501', 'event timestamp update denied')
  const history = await first.repository.openings(first.id)
  check(history.length === 2 && history.every(event => event.devotional_id === ids[0]), 'repeat opens persist as distinct events')
  const session = (await first.client.auth.getSession()).data.session
  const fresh = makeClient()
  check(!(await fresh.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })).error, 'session restored in fresh client')
  check((await createDevotionalRepository(fresh).openings(first.id)).length === 2, 'history persists when read from fresh client')
  check(!(await first.client.auth.signOut()).error, 'reader logout succeeds')
  check((await first.client.from('devotionals').select('id')).error?.code === '42501', 'anonymous content read denied')
  check((await first.client.from('devotional_views').select('id')).error?.code === '42501', 'anonymous history read denied')
  check(!(await first.client.auth.signInWithPassword({ email: first.email, password: first.password })).error, 'reader logs in again')
  check((await first.repository.openings(first.id)).length === 2, 'personal history survives logout and new login')
  check((await first.client.rpc('devotional_open_counts')).error?.code === '42501', 'reader denied administrative metrics')
  check(!(await first.client.auth.signOut()).error && !(await second.client.auth.signOut()).error, 'test reader sessions logged out')
  console.log(`${passed} local library HTTP checks passed. Two synthetic accounts and five content fixtures retained; no secrets printed.`)
} catch {
  console.error(`Local library validation stopped at ${stage}; ${passed} checks passed. Remaining checks NOT executed.`)
  process.exitCode = 1
}
