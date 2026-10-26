import { prepareLocalScript, localUrl } from './local-environment.mjs'
// Opt-in HTTP integration. Two synthetic accounts and editorial fixtures remain local.
import { randomUUID } from 'node:crypto'
import { setLocalAdmin } from './local-admin-tools.mjs'
import { createAdminRepository } from '../src/admin/repository.ts'
import { createDevotionalRepository } from '../src/devotionals/repository.ts'

let passed = 0
let stage = 'local status'
let adminId
function check(ok, label) { stage = label; if (!ok) throw new Error('check failed'); passed++; console.log(`PASS ${label}`) }
const local = prepareLocalScript()
const { mail } = local

async function request(url, options) { return local.fetch(url, options) }
try {
  const makeClient = () => local.client()
  async function reader() {
    const client = makeClient()
    const email = `selah-editor-${randomUUID()}@example.invalid`
    const password = `Fiction-${randomUUID()}!`
    const result = await client.auth.signUp({ email, password, options: { emailRedirectTo: 'http://127.0.0.1:5173', data: { role: 'admin' } } })
    check(!result.error && result.data.user && !result.data.session, 'synthetic account awaits confirmation')
    let link
    for (let attempt = 0; attempt < 20 && !link; attempt++) {
      const list = await (await request(`${mail}/api/v1/messages`)).json()
      const message = list.messages?.find(m => m.To?.some(to => to.Address === email))
      if (message) {
        const detail = await (await request(`${mail}/api/v1/message/${message.ID}`)).json()
        link = ((detail.Text || detail.HTML).match(/https?:\/\/[^\s"<>]+/g) || []).map(value => value.replaceAll('&amp;', '&')).find(value => value.includes('/auth/v1/verify?'))
      }
      if (!link) await new Promise(resolve => setTimeout(resolve, 500))
    }
    check(Boolean(link), 'confirmation received in local Mailpit')
    const response = await request(link)
    const tokens = new URLSearchParams(localUrl(response.headers.get('location'), 'frontend').hash.slice(1))
    check(!(await client.auth.setSession({ access_token: tokens.get('access_token'), refresh_token: tokens.get('refresh_token') })).error, 'synthetic account confirmed')
    return { client, id: result.data.user.id, email, password }
  }
  const editor = await reader()
  const readerUser = await reader()
  const repository = createAdminRepository(editor.client)
  const readerRepo = createAdminRepository(readerUser.client)
  const draft = { title: `Mensagem Fictícia ${randomUUID()}`, bible_reference: 'Referência fictícia', bible_text: 'Texto bíblico fictício', content: 'Reflexão fictícia do teste administrativo.', reflection_question: 'Pergunta fictícia?', status: 'draft', publish_at: null }
  check((await editor.client.rpc('devotional_open_counts')).error?.code === '42501', 'forged metadata does not grant administration')
  let denied = false
  try { await readerRepo.list() } catch (error) { denied = error.code === '42501' }
  check(denied, 'reader denied administrative repository')
  stage = 'trusted local provision'
  setLocalAdmin(editor.id, true); adminId = editor.id
  check(!(await editor.client.rpc('devotional_open_counts')).error, 'local trusted membership authorizes same session')
  const created = await repository.save(editor.id, { ...draft, author_id: readerUser.id, created_at: '2000-01-01' })
  check(created.author_id === editor.id && created.status === 'draft', 'admin creates draft with own server-linked authorship')
  check(Boolean(created.id && created.created_at && created.updated_at), 'server generates identity and timestamps')
  check((await repository.list()).some(item => item.id === created.id), 'draft persists in administrative list')
  const hidden = await readerUser.client.from('devotionals').select('id').eq('id', created.id)
  check(!hidden.error && hidden.data.length === 0, 'reader cannot see draft via direct API')
  const edited = await repository.save(editor.id, { ...created, title: 'Título Fictício Atualizado', author_id: readerUser.id, updated_at: '2000-01-01' }, created.id)
  check(edited.title === 'Título Fictício Atualizado' && edited.author_id === editor.id && edited.created_at === created.created_at && new Date(edited.updated_at) > new Date(created.updated_at), 'authorized update persists without changing author or created_at')
  const scheduled = await repository.save(editor.id, { ...edited, status: 'scheduled', publish_at: new Date(Date.now() + 86_400_000).toISOString() }, created.id)
  check(scheduled.status === 'scheduled', 'admin schedules content with future timestamp')
  const scheduleHidden = await readerUser.client.from('devotionals').select('id').eq('id', created.id)
  check(!scheduleHidden.error && scheduleHidden.data.length === 0, 'reader cannot see scheduled content via direct API')
  const published = await repository.save(editor.id, { ...scheduled, status: 'published', publish_at: new Date().toISOString() }, created.id)
  check(published.status === 'published', 'admin explicitly publishes scheduled content')
  const publicRead = await readerUser.client.from('devotionals').select('id,title').eq('id', created.id)
  check(!publicRead.error && publicRead.data[0]?.title === published.title, 'reader sees explicitly published content')
  check((await createDevotionalRepository(readerUser.client).published(new Date())).some(item => item.id === created.id), 'reader acervo integrates published content')
  const future = await repository.save(editor.id, { ...draft, title: 'Publicado futuro fictício' })
  const futureUpdate = await editor.client.from('devotionals').update({ status: 'published', publish_at: new Date(Date.now() + 86_400_000).toISOString() }).eq('id', future.id)
  check(!futureUpdate.error, 'existing database contract permits admin future published status')
  const futureHidden = await readerUser.client.from('devotionals').select('id').eq('id', future.id)
  check(!futureHidden.error && futureHidden.data.length === 0, 'future published content remains hidden by RLS')
  const unpublish = await repository.save(editor.id, { ...published, status: 'draft', publish_at: null }, created.id)
  check(unpublish.status === 'draft', 'admin returns publication to draft without deleting it')
  const unpublished = await readerUser.client.from('devotionals').select('id').eq('id', created.id)
  check(!unpublished.error && unpublished.data.length === 0, 'returned draft becomes hidden from direct reader API')
  const unauthorizedCreate = await readerUser.client.from('devotionals').insert({ ...draft, author_id: readerUser.id })
  check(unauthorizedCreate.error?.code === '42501', 'reader direct creation denied')
  const unauthorizedUpdate = await readerUser.client.from('devotionals').update({ title: 'Tentativa fictícia' }).eq('id', created.id).select('id')
  check(!unauthorizedUpdate.error && unauthorizedUpdate.data.length === 0, 'reader direct update affects zero rows')
  const forgedAuthor = await editor.client.from('devotionals').insert({ ...draft, author_id: readerUser.id })
  check(forgedAuthor.error?.code === '42501', 'admin direct forged authorship denied')
  for (const [field, value] of [['author_id', readerUser.id], ['created_at', '2000-01-01T00:00:00Z'], ['updated_at', '2000-01-01T00:00:00Z']]) {
    const result = await editor.client.from('devotionals').update({ [field]: value }).eq('id', created.id)
    check(result.error?.code === '42501', `protected ${field} update denied`)
  }
  const invalid = await editor.client.from('devotionals').insert({ ...draft, title: ' ', author_id: editor.id })
  check(invalid.error?.code === '23514', 'database rejects empty title')
  const privateList = await editor.client.schema('private').from('admin_users').select('user_id')
  check(Boolean(privateList.error), 'admin membership list remains outside public API')
  check((await readerUser.client.rpc('devotional_open_counts')).error?.code === '42501', 'reader metrics access denied')
  const readerEvent = await readerUser.client.from('devotional_views').select('id')
  check(!readerEvent.error && readerEvent.data.length === 0, 'reader has only own event scope')
  const tokens = (await editor.client.auth.getSession()).data.session
  const fresh = makeClient()
  check(!(await fresh.auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token })).error, 'admin session restored in fresh client')
  check((await createAdminRepository(fresh).list()).some(item => item.id === created.id && item.title === edited.title), 'administrative edits persist in fresh client')
  check(!(await editor.client.auth.signOut()).error && !(await editor.client.auth.signInWithPassword({ email: editor.email, password: editor.password })).error, 'admin logs out and signs in again')
  check((await repository.list()).some(item => item.id === created.id && item.status === 'draft'), 'administrative content persists after new login')
  stage = 'local membership revocation'
  setLocalAdmin(editor.id, false); adminId = undefined
  check((await editor.client.rpc('devotional_open_counts')).error?.code === '42501', 'revocation takes effect without new claims')
  let revoked = false
  try { await repository.save(editor.id, draft, created.id) } catch (error) { revoked = error.code === '42501' }
  check(revoked, 'repository refuses update after membership revocation')
  const revokedDirect = await editor.client.from('devotionals').update({ title: 'Tentativa revogada' }).eq('id', created.id).select('id')
  check(!revokedDirect.error && revokedDirect.data.length === 0, 'direct update denied after revocation')
  check(!(await editor.client.auth.signOut()).error && !(await readerUser.client.auth.signOut()).error, 'synthetic clients logged out')
  console.log(`${passed} administrative HTTP checks passed. Two synthetic accounts and two devotionals retained locally; test admin grant revoked. No secrets printed.`)
} catch {
  console.error(`Admin validation stopped at ${stage}; ${passed} checks passed. Remaining checks NOT executed.`)
  process.exitCode = 1
} finally {
  if (adminId) {
    try { setLocalAdmin(adminId, false); console.log('Synthetic test administration revoked.') }
    catch { console.error('Unable to revoke synthetic local test membership; trusted operator must inspect private.admin_users locally.'); process.exitCode = 1 }
  }
}
