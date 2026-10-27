import { randomUUID } from 'node:crypto'
import { prepareLocalScript } from './local-environment.mjs'
import { readingAccount,seedReadingContent,sleep } from './reading-local-fixtures.mjs'
import { seedConsistency } from './consistency-local-fixtures.mjs'
import { createConsistencyRepository } from '../src/consistency/repository.ts'
import { createReadingRepository } from '../src/reading/repository.ts'
const local=prepareLocalScript()
let passed=0,stage='new fictitious accounts',admin
function check(ok,label){stage=label;if(!ok)throw Error('Local consistency check failed');passed++;console.log('PASS '+label)}
try {
  const a=await readingAccount(local),b=await readingAccount(local)
  const own=createConsistencyRepository(a.client),other=createConsistencyRepository(b.client)
  let snapshot=await own.snapshot()
  check(snapshot.status==='empty'&&snapshot.current_streak===0&&snapshot.best_streak===0&&snapshot.total_days===0,'new reader has zero metrics without invented conclusions')
  check(snapshot.time_zone==='America/Sao_Paulo'&&snapshot.server_today===new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(snapshot.server_now)),'trusted current civil day agrees with server instant')
  check(snapshot.days.length>=28&&snapshot.days.length<=31&&snapshot.days.every(d=>d.completions===0),'empty month contains bounded calendar cells')
  const anonymous=local.client()
  check(Boolean((await anonymous.rpc('get_my_consistency',{p_month:null})).error),'anonymous cannot read devotional habits')
  for(const args of [{p_month:null,p_user_id:b.id},{p_month:null,p_today:'2099-01-01'},{p_month:null,p_current_streak:999}])check(Boolean((await a.client.rpc('get_my_consistency',args)).error),'API refuses user, today or counter supplied by caller')
  const invalid=await a.client.rpc('get_my_consistency',{p_month:'2026-10-02'})
  check(Boolean(invalid.error),'server rejects a non-month calendar selection')
  seedConsistency(local,a.id,{offsets:[-16,-15,-14,-13,-12,-11,-10,-3,-2,-1,-1]})
  seedConsistency(local,b.id,{offsets:Array.from({length:1005},(_,n)=>-n)})
  admin=b.id;local.psql(`begin;insert into private.admin_users(user_id)values('${admin}');commit;`)
  snapshot=await own.snapshot()
  check(snapshot.status==='pending_today'&&snapshot.current_streak===3&&!snapshot.today_completed,'last completion yesterday keeps three-day streak pending today')
  check(snapshot.best_streak===7&&snapshot.total_days===10&&snapshot.total_devotionals===11,'record, distinct days and total conclusions remain distinct')
  check(Object.keys(snapshot).every(key=>['server_now','server_today','time_zone','month','current_month','first_month','current_streak','best_streak','today_completed','total_days','total_devotionals','last_completed_day','status','days'].includes(key))&&!JSON.stringify(snapshot).includes('@'),'summary projection includes no private email, phone, user ID or content ID')
  const big=await other.snapshot()
  check(big.current_streak===1005&&big.best_streak===1005&&big.total_days===1005&&big.total_devotionals===1005,'more than one thousand records aggregate without REST truncation')
  const stolen=await b.client.from('devotional_completions').select('source_devotional_id').eq('user_id',a.id)
  check(!stolen.error&&stolen.data.length===0,'administrator cannot read another reader ledger through API')
  check(big.current_streak!==snapshot.current_streak,'administrator summary reflects only its own ledger')
  const beforeCount=await a.client.from('devotional_completions').select('*',{count:'exact',head:true}).eq('user_id',a.id)
  const parallel=await Promise.all(Array.from({length:10},()=>own.snapshot()))
  const afterCount=await a.client.from('devotional_completions').select('*',{count:'exact',head:true}).eq('user_id',a.id)
  check(parallel.every(s=>s.current_streak===3&&s.total_devotionals===11)&&beforeCount.count===11&&afterCount.count===11,'ten concurrent reads are idempotent and never add completions')
  const oldReceipt=await a.client.from('devotional_completions').select('source_devotional_id').eq('user_id',a.id).order('completed_day').limit(1).single()
  const reading=createReadingRepository(a.client)
  check(!oldReceipt.error&&(await reading.complete(oldReceipt.data.source_devotional_id)).status==='completed'&&(await own.snapshot()).status==='pending_today','repeating historical conclusion cannot create a new day')
  const past=await own.snapshot(snapshot.first_month)
  check(past.month===snapshot.first_month&&past.current_streak===3&&past.total_devotionals===11,'calendar navigation does not change lifetime metrics')
  check(Boolean((await a.client.from('devotional_completions').update({completed_day:'2099-01-01'}).eq('user_id',a.id)).error),'reader cannot backdate or future-date ledger')
  const ids=seedReadingContent(local,b.id),tab=randomUUID()
  check((await reading.complete(ids[0])).status==='too_early','consistency does not bypass sixty-second reading rule')
  let lease=await reading.start(ids[0],tab,1)
  stage='real sixty-second reading for today'
  while(lease.credited_ms<60000){await sleep(5100);lease=await reading.checkpoint(ids[0],tab,lease.token,lease.sequence+1);if(!['active','ready'].includes(lease.status))throw Error('Reading interval interrupted');console.log('Confirmed server reading: '+Math.floor(lease.credited_ms/1000)+'/60 seconds')}
  check((await own.snapshot()).status==='pending_today','eligible reading never changes streak before voluntary completion')
  const receipt=await reading.complete(ids[0])
  const today=await own.snapshot()
  check(receipt.status==='completed'&&today.status==='completed_today'&&today.today_completed&&today.current_streak===4,'real voluntary conclusion advances pending streak and marks today')
  check(today.best_streak===7&&today.total_days===11&&today.total_devotionals===12,'real conclusion preserves record and increments distinct totals correctly')
  check(today.days.find(d=>d.date===today.server_today)?.completions===1,'current calendar reflects real persisted completion')
  await reading.complete(ids[0]);const repeated=await own.snapshot()
  check(repeated.total_days===11&&repeated.total_devotionals===12&&repeated.current_streak===4,'idempotent rereading cannot increase any streak metric')
  check(!(await a.client.auth.signOut()).error&&!(await a.client.auth.signInWithPassword({email:a.email,password:a.password})).error&&(await own.snapshot()).current_streak===4,'new login preserves backend streak and calendar')
  // A NEW synthetic pre-trigger account, with no existing account modified.
  const legacyId=randomUUID(),email=`selah-consistency-${randomUUID()}@example.invalid`,password=`Fiction-${randomUUID()}!`
  local.psql(`begin;set local session_replication_role=replica;
    insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token)
    values('${legacyId}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}',extensions.crypt('${password}',extensions.gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','','','','','','','','');
    set local session_replication_role=origin;
    insert into auth.identities(id,provider_id,user_id,identity_data,provider,created_at,updated_at) values('${randomUUID()}','${legacyId}','${legacyId}','{"sub":"${legacyId}","email":"${email}","email_verified":true}','email',now(),now());
    insert into public.profiles(id) values('${legacyId}');commit;`)
  const legacy=local.client()
  check(!(await legacy.auth.signInWithPassword({email,password})).error&&(await createConsistencyRepository(legacy).snapshot()).status==='empty','legacy account without username or phone can read its empty consistency')
  seedConsistency(local,legacyId,{dates:['2018-12-31','2019-01-01']})
  const legacyRepo=createConsistencyRepository(legacy),december=await legacyRepo.snapshot('2018-12-01'),january=await legacyRepo.snapshot('2019-01-01')
  check(december.best_streak===2&&december.current_streak===0&&december.status==='interrupted'&&december.days.at(-1).completions===1,'historical December retains interrupted record and last day')
  check(january.days[0].completions===1&&january.days[0].date==='2019-01-01'&&january.total_days===2,'calendar year transition preserves frozen civil days')
  check((await legacyRepo.snapshot('2024-02-01')).days.length===29,'real API returns leap February correctly')
  await a.client.auth.signOut();await b.client.auth.signOut();await legacy.auth.signOut()
  console.log(`${passed} local consistency HTTP checks passed. Only new synthetic fixtures retained; no existing account or content changed.`)
} catch {console.error(`Consistency HTTP stopped at ${stage}; ${passed} checks passed; remaining checks NOT executed.`);process.exitCode=1}
finally{if(admin)local.psql(`begin;delete from private.admin_users where user_id='${admin}';commit;`)}
