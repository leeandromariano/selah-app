// Additional local HTTP coverage: distinct Auth sessions and a NEW legacy fixture.
import { randomUUID } from 'node:crypto'
import { prepareLocalScript } from './local-environment.mjs'
import { seedReadingContent, sleep } from './reading-local-fixtures.mjs'
import { createReadingRepository } from '../src/reading/repository.ts'
const local=prepareLocalScript()
let passed=0,stage='synthetic legacy fixture'
function check(ok,label) {stage=label;if(!ok)throw Error('Session check failed');passed++;console.log('PASS '+label)}
try {
  const id=randomUUID(),email=`selah-reading-${randomUUID()}@example.invalid`,password=`Fiction-${randomUUID()}!`
  if(!/^selah-reading-[0-9a-f-]+@example\.invalid$/.test(email)||!/^Fiction-[0-9a-f-]+!$/.test(password))throw Error('Invalid fixture')
  local.psql(`begin; set local session_replication_role=replica;
    insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token)
    values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}',extensions.crypt('${password}',extensions.gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','','','','','','','','');
    set local session_replication_role=origin;
    insert into auth.identities(id,provider_id,user_id,identity_data,provider,created_at,updated_at) values ('${randomUUID()}','${id}','${id}','{"sub":"${id}","email":"${email}","email_verified":true}','email',now(),now());
    insert into public.profiles(id) values ('${id}');commit;`)
  const first=local.client(),device=local.client(),last=local.client(),a=randomUUID(),b=randomUUID(),c=randomUUID()
  check(!(await first.auth.signInWithPassword({email,password})).error,'legacy account with no username or WhatsApp authenticates through official Auth')
  check(!(await device.auth.signInWithPassword({email,password})).error,'second Auth session authenticates same fictitious account')
  const firstSession=(await first.auth.getSession()).data.session,deviceSession=(await device.auth.getSession()).data.session
  const sessionId=s=>JSON.parse(Buffer.from(s.access_token.split('.')[1],'base64url').toString()).session_id
  check(sessionId(firstSession)!==sessionId(deviceSession),'devices use genuinely distinct Auth session IDs')
  check((await first.from('account_usernames').select('username')).data?.length===0,'legacy reading does not assign username implicitly')
  check((await first.from('profiles').select('phone').single()).data?.phone===null,'legacy account retains empty optional phone without reading blockage')
  const ids=seedReadingContent(local,id),r1=createReadingRepository(first),r2=createReadingRepository(device)
  let lease=await r1.start(ids[0],a,1)
  check(lease.status==='active','legacy account starts real reading without completing profile')
  check((await r2.start(ids[0],b,1)).status==='elsewhere','second Auth session cannot silently steal first reading')
  await sleep(5100)
  lease=await r1.checkpoint(ids[0],a,lease.token,1)
  const saved=lease.credited_ms
  check(saved>=5000,'first session confirms real server time')
  const transfer=await r2.start(ids[0],b,1,true)
  check(transfer.status==='active'&&transfer.token!==lease.token&&transfer.credited_ms===saved,'cross-device transfer keeps time and rotates authorization')
  check((await r1.checkpoint(ids[0],a,lease.token,2)).status==='elsewhere','former Auth session cannot extend transferred lease')
  check((await r2.start(ids[1],b,1)).status==='elsewhere','same device cannot multiply time across two texts')
  const other=await r2.start(ids[1],b,1,true)
  check(other.status==='active'&&other.credited_ms===0,'explicit change of text starts its own independent ledger')
  check((await r1.state(ids[0])).credited_ms===saved,'switching texts preserves confirmed incomplete progress')
  await r2.pause(ids[1],b,other.token)
  check(!(await device.auth.signOut()).error,'official logout succeeds for timed reader')
  check(!(await last.auth.signInWithPassword({email,password})).error,'fresh login succeeds after logout')
  const r3=createReadingRepository(last)
  check((await r3.state(ids[0])).credited_ms===saved,'incomplete confirmed progress survives logout and new login')
  let resumed=await r3.start(ids[0],c,1)
  if(resumed.status==='elsewhere')resumed=await r3.start(ids[0],c,1,true)
  await sleep(5100)
  resumed=await r3.checkpoint(ids[0],c,resumed.token,1)
  check(resumed.credited_ms>=saved+5000&&resumed.credited_ms<60000,'new login resumes same ledger without fabricating completion')
  await r3.pause(ids[0],c,resumed.token)
  const forged=await last.rpc('start_reading',{p_devotional_id:ids[0],p_client_id:c,p_revision:1,p_session_id:sessionId(firstSession)})
  check(Boolean(forged.error),'client cannot choose Auth session ID')
  const complete=await r3.complete(ids[0])
  check(complete.status==='too_early','legacy compatibility never bypasses sixty-second requirement')
  await last.auth.signOut()
  console.log(`${passed} local reading session HTTP checks passed. One new synthetic legacy fixture retained; existing accounts unchanged.`)
} catch { console.error(`Reading sessions stopped at ${stage}; ${passed} checks passed; remaining checks NOT executed.`);process.exitCode=1 }
