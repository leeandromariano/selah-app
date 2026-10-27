import { prepareLocalScript } from './local-environment.mjs'
import { readingAccount } from './reading-local-fixtures.mjs'
import { seedConsistency } from './consistency-local-fixtures.mjs'
import { createCommunityRepository } from '../src/consistency/community.ts'
const local=prepareLocalScript()
let passed=0,owner,publisher
function check(ok,label){if(!ok)throw Error(label);passed++;console.log('PASS '+label)}
try {
  if(!/\b0\b/.test(local.psql('begin read only; select count(*) from private.app_owner; rollback;')))throw Error('Existing owner retained; synthetic exclusive grant refused')
  const a=await readingAccount(local),b=await readingAccount(local),c=await readingAccount(local)
  owner=a.id;publisher=b.id
  local.psql(`begin; insert into private.app_owner(user_id) values('${owner}'); insert into private.admin_users(user_id) values('${publisher}'); commit;`)
  seedConsistency(local,c.id,{offsets:[-2,-1],dates:['2018-01-01','2018-01-02','2018-01-03']})
  const repo=createCommunityRepository(a.client)
  const all=await repo.list()
  check(all.total_readers>=3&&all.readers.length<=25,'owner sees bounded community page and totals')
  const single=await repo.list(c.username)
  check(single.matched_readers===1&&single.readers[0].username===c.username&&single.readers[0].current_streak===2&&single.readers[0].best_streak===3&&single.readers[0].total_days===5&&single.readers[0].status==='pending_today','owner queries individual username with streak and record')
  check((await repo.list(a.username)).readers[0].status==='empty','reader without conclusions included with zero')
  const keys=Object.keys((await a.client.rpc('get_owner_community',{p_search:c.username})).data.readers[0]).sort().join()
  check(keys===['username','current_streak','best_streak','total_days','status'].sort().join(),'HTTP projection excludes contacts history text seconds and IDs')
  const page0=await repo.list('',0,1),page1=await repo.list('',1,1)
  check(page0.readers.length===1&&page1.readers.length===1&&JSON.stringify(page0.readers)!==JSON.stringify(page1.readers),'real pagination across stable ordered pages')
  for(const [client,label] of [[b.client,'publisher'],[c.client,'reader'],[local.client(),'anonymous']]) check(Boolean((await client.rpc('get_owner_community')).error),label+' denied by backend without relying on UI')
  await c.client.auth.updateUser({data:{role:'OWNER',owner:true}})
  check(Boolean((await c.client.rpc('get_owner_community')).error),'forged user metadata never grants OWNER')
  check(Boolean((await c.client.rpc('get_owner_community',{p_user_id:a.id})).error),'caller cannot substitute owner ID')
  check(Boolean((await c.client.schema('private').from('app_owner').insert({user_id:c.id})).error),'reader cannot grant own membership')
  const ledger=await a.client.from('devotional_completions').select('user_id').eq('user_id',c.id)
  check(!ledger.error&&ledger.data.length===0,'OWNER cannot browse another ledger directly')
  check(Boolean((await a.client.rpc('get_owner_community',{p_size:101})).error),'backend enforces maximum page size')
  for(const account of [a,b,c])await account.client.auth.signOut()
  console.log(`${passed} local OWNER HTTP checks passed; synthetic fixtures retained.`)
} catch(error){console.error('OWNER HTTP failed: '+error.message);process.exitCode=1}
finally {
  if(owner)local.psql(`begin; delete from private.app_owner where user_id='${owner}'; commit;`)
  if(publisher)local.psql(`begin; delete from private.admin_users where user_id='${publisher}'; commit;`)
}
