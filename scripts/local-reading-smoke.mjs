import { randomUUID } from 'node:crypto'
import { prepareLocalScript } from './local-environment.mjs'
import { readingAccount, seedReadingContent, sleep } from './reading-local-fixtures.mjs'
import { createReadingRepository } from '../src/reading/repository.ts'
const local = prepareLocalScript()
let passed=0, stage='synthetic setup', admin
function check(ok,label) { stage=label; if (!ok) throw Error('HTTP check failed'); passed++; console.log('PASS '+label) }
try {
  const first=await readingAccount(local), second=await readingAccount(local)
  check(Boolean(first.id && second.id),'two fictitious readers confirmed through local Mailpit')
  admin=second.id
  local.psql(`begin; insert into private.admin_users(user_id) values ('${admin}'); commit;`)
  const ids=seedReadingContent(local,second.id)
  const reader=createReadingRepository(first.client), other=createReadingRepository(second.client)
  const tab=randomUUID(), nextTab=randomUUID()
  const anonymous=local.client()
  check(Boolean((await anonymous.rpc('get_my_reading_state',{p_devotional_id:ids[0]})).error),'anonymous RPC denied')
  check(Boolean((await anonymous.from('devotional_completions').select('*')).error),'anonymous receipts denied')
  check(Boolean((await first.client.from('reading_progress').insert({user_id:first.id,devotional_id:ids[0],revision:1,credited_ms:60000})).error),'direct progress forgery denied by API')
  check(Boolean((await first.client.from('devotional_completions').insert({user_id:first.id,source_devotional_id:ids[0],revision:1,completed_at:'2000-01-01T00:00:00Z',completed_day:'2000-01-01'})).error),'direct completion/date forgery denied by API')
  for (const extra of [{p_user_id:second.id},{p_duration_ms:60000},{p_completed_at:'2099-01-01T00:00:00Z'}]) check(Boolean((await first.client.rpc('complete_devotional',{p_devotional_id:ids[0],...extra})).error),'RPC rejects client-selected user, duration or date')
  for (const id of ids.slice(2)) {
    check((await reader.start(id,tab,1)).status==='unavailable','reader cannot time draft, scheduled or future content')
    check((await other.complete(id)).status==='unavailable','administrator also cannot complete unavailable content')
  }
  const opened=await first.client.from('devotional_views').insert({devotional_id:ids[0]}).select('id').single()
  check(!opened.error && (await reader.state(ids[0])).credited_ms===0,'opening stays separate from time and completion')
  check((await reader.complete(ids[0])).status==='too_early','premature completion denied through real API')
  let lease=await reader.start(ids[0],tab,1)
  check(lease.status==='active','authenticated reading starts')
  check((await reader.start(ids[1],nextTab,1)).status==='elsewhere','one active reading across devotional IDs')
  const old=lease
  lease=await reader.start(ids[0],nextTab,1,true)
  check(lease.token!==old.token && lease.status==='active','explicit transfer rotates server token')
  check((await reader.checkpoint(ids[0],tab,old.token,1)).status==='elsewhere','old tab cannot credit after transfer')
  check((await reader.start(ids[0],nextTab,1)).token===lease.token,'repeated start does not create another clock')
  check((await reader.checkpoint(ids[0],nextTab,lease.token,2)).status==='out_of_order','out-of-order sequence rejected')
  check((await reader.checkpoint(ids[0],nextTab,lease.token,0)).credited_ms===0,'initial checkpoint replay credits nothing')
  await sleep(5100)
  const concurrent=await Promise.all(Array.from({length:5},()=>reader.checkpoint(ids[0],nextTab,lease.token,1)))
  lease=concurrent[0]
  check(concurrent.every(s=>s.credited_ms===lease.credited_ms) && lease.credited_ms>=5000 && lease.credited_ms<10000,'five simultaneous checkpoints credit one server interval')
  const beforePause=lease.credited_ms
  await reader.pause(ids[0],nextTab,lease.token); await sleep(6000)
  check((await reader.state(ids[0])).credited_ms===beforePause,'paused elapsed wall time supplies no credit')
  lease=await reader.start(ids[0],nextTab,1)
  await sleep(11000)
  lease=await reader.checkpoint(ids[0],nextTab,lease.token,1)
  check(lease.status==='gap' && lease.credited_ms===beforePause,'delayed checkpoint discards whole interval')
  stage='real sixty-second HTTP protocol'
  while(lease.credited_ms<60000) {
    await sleep(5100)
    lease=await reader.checkpoint(ids[0],nextTab,lease.token,lease.sequence+1)
    if (!['active','ready'].includes(lease.status)) throw Error('Clock protocol interrupted')
    console.log('Confirmed server reading: '+Math.floor(lease.credited_ms/1000)+'/60 seconds')
  }
  check(lease.status==='ready' && lease.credited_ms===60000,'at least sixty real seconds confirmed by PostgreSQL')
  const notYet=await first.client.from('devotional_completions').select('source_devotional_id').eq('source_devotional_id',ids[0])
  check(!notYet.error && notYet.data.length===0,'sixty seconds never auto-completes')
  const receipts=await Promise.all(Array.from({length:5},()=>reader.complete(ids[0])))
  const receipt=receipts[0]
  check(receipts.every(r=>r.status==='completed' && r.completed_at===receipt.completed_at),'concurrent voluntary completions return one receipt')
  const own=await first.client.from('devotional_completions').select('*').eq('source_devotional_id',ids[0])
  check(!own.error && own.data.length===1 && own.data[0].user_id===first.id,'exactly one persisted completion owned by session')
  check(own.data[0].completed_day===new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(own.data[0].completed_at)),'completion civil day derived from server instant in Sao Paulo')
  const stolen=await second.client.from('devotional_completions').select('*').eq('user_id',first.id)
  check(!stolen.error && stolen.data.length===0,'administrator cannot read another reader completion by direct API')
  const stolenTime=await second.client.from('reading_progress').select('*').eq('user_id',first.id)
  check(!stolenTime.error && stolenTime.data.length===0,'administrator cannot read another reader progress by direct API')
  check((await other.state(ids[0])).credited_ms===0,'other account cannot inherit confirmed time')
  const session=(await first.client.auth.getSession()).data.session
  const restored=local.client()
  check(!(await restored.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token})).error && (await createReadingRepository(restored).state(ids[0])).completed_at===receipt.completed_at,'official setSession restores persisted completion')
  check(!(await first.client.auth.signOut()).error,'official logout succeeds')
  check(!(await first.client.auth.signInWithPassword({email:first.email,password:first.password})).error && (await reader.state(ids[0])).completed_at===receipt.completed_at,'new email login preserves completion')
  let progress=await reader.start(ids[1],tab,1)
  await sleep(5100); progress=await reader.checkpoint(ids[1],tab,progress.token,1)
  check(progress.credited_ms>=5000,'another text accumulates independent time')
  const edit=await second.client.from('devotionals').update({content:'Reflexão fictícia revisada durante a leitura.'}).eq('id',ids[1])
  check(!edit.error,'authorized editorial change succeeds through API')
  const revised=await reader.state(ids[1])
  check(revised.revision_changed && revised.credited_ms===0 && revised.revision===2,'editorial revision invalidates incomplete time only')
  check((await reader.start(ids[1],tab,1)).status==='revision_changed','stale content cannot resume timing')
  const unpublish=await second.client.from('devotionals').update({status:'draft'}).eq('id',ids[1])
  check(!unpublish.error && (await reader.complete(ids[1])).status==='unavailable','unpublished text cannot receive new completion')
  const historicalEdit=await second.client.from('devotionals').update({content:'Edição fictícia posterior à conclusão.',status:'draft'}).eq('id',ids[0])
  check(!historicalEdit.error && (await reader.complete(ids[0])).completed_at===receipt.completed_at,'historical completion survives edit and unpublish')
  // Delete only content generated by this exact invocation; no prior rows touched.
  const removed=await second.client.from('devotionals').delete().eq('id',ids[0])
  const tombstone=await first.client.from('devotional_completions').select('*').eq('source_devotional_id',ids[0]).single()
  check(!removed.error && !tombstone.error && tombstone.data.devotional_id===null && tombstone.data.source_devotional_id===ids[0],'deleted synthetic content preserves original completion identity without text')
  const view=await first.client.from('devotional_views').select('devotional_id').eq('id',opened.data.id).single()
  check(!view.error && view.data.devotional_id===null,'opening survives deletion of synthetic content')
  check((await reader.complete(ids[0])).completed_at===receipt.completed_at,'deleted completion remains idempotent')
  console.log(`${passed} local reading HTTP checks passed. Real server time used; fixtures retained except one test-created devotional. No existing data deleted.`)
} catch {
  console.error(`Local reading HTTP stopped at ${stage}; ${passed} checks passed; remaining checks NOT executed.`)
  process.exitCode=1
} finally {
  if (admin) local.psql(`begin; delete from private.admin_users where user_id='${admin}'; commit;`)
}
