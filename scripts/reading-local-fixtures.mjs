// Internal helper for opt-in, guarded local tests. Credentials exist only in RAM.
import { randomUUID } from 'node:crypto'
import { localUrl } from './local-environment.mjs'
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
export function uuid(value) { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw Error('Invalid synthetic UUID'); return value }
export async function readingAccount(local) {
  const client = local.client()
  const email = `selah-reading-${randomUUID()}@example.invalid`, password = `Fiction-${randomUUID()}!`
  const username = 'u' + randomUUID().replaceAll('-', '').slice(0, 20)
  const signup = await client.auth.signUp({ email, password, options: { emailRedirectTo: local.frontend, data: { username, whatsapp: '+5511999990000', feedback_contact_allowed: false } } })
  if (signup.error || !signup.data.user || signup.data.session) throw Error('Synthetic signup failed')
  let link
  for (let i = 0; i < 30 && !link; i++) {
    const list = await (await local.fetch(local.mail + '/api/v1/messages')).json()
    const item = list.messages?.find(m => m.To?.some(to => to.Address === email))
    if (item) {
      const content = await (await local.fetch(local.mail + '/api/v1/message/' + item.ID)).json()
      link = ((content.Text || content.HTML).match(/https?:\/\/[^\s"<>]+/g) || []).map(x => x.replaceAll('&amp;', '&')).find(x => x.includes('/auth/v1/verify?'))
    }
    if (!link) await sleep(500)
  }
  if (!link) throw Error('Local Mailpit confirmation unavailable')
  const response = await local.fetch(link)
  const tokens = new URLSearchParams(localUrl(response.headers.get('location'), 'frontend').hash.slice(1))
  const result = await client.auth.setSession({ access_token: tokens.get('access_token'), refresh_token: tokens.get('refresh_token') })
  if (result.error) throw Error('Local synthetic confirmation failed')
  return { client, id: uuid(signup.data.user.id), email, password, username }
}
export function seedReadingContent(local, authorId, count = 5) {
  uuid(authorId)
  const ids = Array.from({ length: count }, () => randomUUID())
  const values = ids.map((id, i) => `('${id}','Leitura fictícia ${i+1}','Referência fictícia','Texto bíblico fictício','Reflexão fictícia para validar permanência confirmada. Nenhum dado real.','Pergunta fictícia?',${i===2 ? 'null' : i===4 ? "clock_timestamp()+interval '1 day'" : "clock_timestamp()-interval '1 day'"},'${i===2 ? 'draft' : i===3 ? 'scheduled' : 'published'}','${authorId}')`).join(',')
  local.psql('begin; insert into public.devotionals(id,title,bible_reference,bible_text,content,reflection_question,publish_at,status,author_id) values '+values+'; commit;')
  return ids
}
