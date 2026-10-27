// Opt-in local integration. Only NEW fictitious accounts are mutated.
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { openOwnerEnvironment, runOwnerOperation } from './local-owner-tools.mjs'
import { readingAccount, uuid } from './reading-local-fixtures.mjs'
let local
try {local=openOwnerEnvironment()} catch {console.error('Local OWNER provisioning environment refused. No identifiers or credentials printed.');process.exit(1)}
if(process.argv[2]==='--check-local'){console.log('Local OWNER provisioning preflight passed. No fixtures or permission changes.');process.exit(0)}
if(process.argv.length!==2){console.error('Local OWNER provisioning test arguments refused.');process.exit(1)}
let passed=0,a,b,c
const ref=()=> 'LOCAL-test-'+randomUUID()
const scope='LOCAL-test-'+randomUUID()
function check(value,label){if(!value)throw Error(label);passed++;console.log('PASS '+label)}
function cli(args,ok){const result=spawnSync(process.execPath,['scripts/provision-local-owner.mjs',...args],{encoding:'utf8'});return result.status===(ok?0:1)&&!(result.stdout+result.stderr).includes('@example.invalid')&&!/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i.test(result.stdout+result.stderr)}
function mutate(action,id,nextId,ok=true,audit=ref()) {
  return cli([action,id,...(action==='transfer'?[nextId]:[]),'--confirm',id,...(action==='transfer'?['--confirm-target',nextId]:[]),'--audit-ref',audit],ok)
}
const inspect=id=>runOwnerOperation(local,{action:'inspect',userId:id})
const allowed=async account=>!(await account.client.rpc('get_owner_community')).error
function cleanupFixture(account) {
  if(inspect(account.id).is_owner&&!mutate('revoke',account.id,null))throw Error('Synthetic cleanup failed')
  local.psql(`begin;delete from private.admin_users where user_id='${account.id}';commit;`)
}
try {
  const missing=randomUUID()
  if(inspect(missing).owner_count!==0)throw Error('Existing owner preserved; synthetic provisioning tests refused')
  a=await readingAccount(local);b=await readingAccount(local);c=await readingAccount(local)
  local.psql(`begin;insert into private.admin_users(user_id) values('${a.id}'),('${b.id}');commit;`)
  check(inspect(a.id).eligible&&!inspect(a.id).is_owner,'exact confirmed editorial target is eligible without promotion')
  check(!inspect(c.id).eligible,'common reader is not eligible')
  check(!inspect(missing).exists,'nonexistent exact account is identified without listing users')
  check(cli(['grant',a.id],false),'missing explicit confirmation denied')
  check(cli(['grant',a.id,'--confirm',b.id,'--audit-ref',ref()],false),'mismatched UUID confirmation denied')
  check(mutate('grant',c.id,null,false),'common reader cannot be provisioned')
  check(mutate('grant',missing,null,false),'nonexistent UUID cannot be provisioned')
  const pending=await local.client().auth.signUp({email:'owner-provision-'+randomUUID()+'@example.invalid',password:'Fiction-'+randomUUID()+'!',options:{data:{username:'u'+randomUUID().replaceAll('-','').slice(0,20),whatsapp:'+5511999990000'}}})
  if(pending.error||!pending.data.user)throw Error('Synthetic pending fixture unavailable')
  const pendingId=uuid(pending.data.user.id)
  local.psql(`begin;insert into private.admin_users(user_id) values('${pendingId}');commit;`)
  try{check(mutate('grant',pendingId,null,false),'unconfirmed editorial target denied')}finally{local.psql(`begin;delete from private.admin_users where user_id='${pendingId}';commit;`)}
  check(!await allowed(a)&&!await allowed(b)&&!await allowed(c),'editorial and reader sessions denied before OWNER grant')
  const duplicateRef=scope+'-grant'
  check(mutate('grant',a.id,null,true,duplicateRef),'trusted CLI grants only exact confirmed target')
  check(await allowed(a)&&!await allowed(b)&&!await allowed(c),'only OWNER session accesses administrative RPC')
  const response=await a.client.rpc('get_owner_community',{p_search:c.username})
  check(!response.error&&response.data.readers.length===1&&Object.keys(response.data.readers[0]).sort().join()===['username','current_streak','best_streak','total_days','status'].sort().join(),'ranking returns minimal fields without contacts or detailed history')
  check(mutate('grant',b.id,null,false)&&inspect(a.id).is_owner&&!inspect(b.id).is_owner,'second OWNER denied without replacement')
  check(mutate('revoke',b.id,null,false)&&inspect(a.id).is_owner,'wrong exact UUID cannot revoke current OWNER')
  check(mutate('transfer',a.id,c.id,false)&&inspect(a.id).is_owner,'transfer to common reader denied atomically')
  check(mutate('transfer',a.id,b.id,false,duplicateRef)&&inspect(a.id).is_owner&&!inspect(b.id).is_owner,'duplicate audit reference rolls back membership change')
  check(mutate('transfer',a.id,b.id,true,scope+'-transfer'),'controlled transfer commits single replacement and audit')
  check(!await allowed(a)&&await allowed(b)&&!await allowed(c),'transfer revokes former OWNER even with same JWT')
  check((await a.client.rpc('devotional_open_counts')).error===null&&(await b.client.rpc('devotional_open_counts')).error===null,'both editorial permissions preserved after transfer')
  const privateAudit=await b.client.schema('private').from('owner_provision_audit').select('*')
  check(Boolean(privateAudit.error),'OWNER cannot access private audit through API')
  check(mutate('revoke',b.id,null,true,scope+'-revoke'),'exact revoke commits with private audit')
  check(!await allowed(a)&&!await allowed(b)&&!await allowed(c)&&inspect(a.id).owner_count===0,'revoke immediately denies all sessions and leaves no OWNER')
  check((await b.client.rpc('devotional_open_counts')).error===null,'revoke preserves editorial privileges')
  const audit=local.psql(`begin read only; select json_build_object('events',(select count(*) from private.owner_provision_audit where audit_ref in ('${scope}-grant','${scope}-transfer','${scope}-revoke')),'editorial',(select count(*) from private.admin_users where user_id in ('${a.id}','${b.id}')));rollback;`)
  const summary=JSON.parse(audit.split(/\r?\n/).find(s=>s.trim().startsWith('{')))
  check(summary.events===3&&summary.editorial===2,'three durable audit transitions and original editorial memberships retained')
  check(mutate('revoke',b.id,null,false),'repeated revoke fails closed instead of false success')
  const race=account=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['scripts/provision-local-owner.mjs','grant',account.id,'--confirm',account.id,'--audit-ref',ref()],{windowsHide:true,stdio:'ignore'})
    child.once('error',()=>reject(Error('Synthetic concurrent process unavailable')))
    child.once('exit',code=>resolve(code))
  })
  const raceResults=await Promise.all([race(a),race(b)])
  check(raceResults.filter(code=>code===0).length===1&&raceResults.filter(code=>code===1).length===1&&inspect(a.id).owner_count===1,'concurrent grants serialize with exactly one OWNER winner')
  const winner=inspect(a.id).is_owner?a:b
  check(mutate('revoke',winner.id,null)&&inspect(winner.id).owner_count===0,'concurrent synthetic winner revoked through audited CLI')
  console.log(`${passed} local OWNER provisioning checks passed. Only new synthetic accounts used; private audit retained.`)
}catch(error){console.error('Local OWNER provisioning check failed: '+error.message);process.exitCode=1}
finally {
  for(const account of [a,b].filter(Boolean)) {
    try {
      cleanupFixture(account)
    } catch {console.error('Synthetic OWNER/editorial cleanup failed; operator review required. No identifiers printed.');process.exitCode=1}
  }
  for(const account of [a,b,c].filter(Boolean))await account.client.auth.signOut()
}
