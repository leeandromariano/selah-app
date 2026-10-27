import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { prepareLocalScript, localUrl } from './local-environment.mjs'
import { createUsernameRepository } from '../src/profiles/username.ts'
const local=prepareLocalScript()
if(process.argv[2]==='--sql'){
 try{process.stdout.write(local.psql(readFileSync('supabase/tests/usernames.sql','utf8')))}catch{console.error('Local username SQL failed; validation incomplete.');process.exit(1)}
 process.exit(0)
}
let passed=0,stage='setup'
function check(ok,label){stage=label;if(!ok)throw Error('check failed');passed++;console.log(`PASS ${label}`)}
const email=()=>`selah-username-${randomUUID()}@example.invalid`
const username=()=> 'u'+randomUUID().replaceAll('-','').slice(0,20)
const password=`Fiction-${randomUUID()}!`
async function signup(name,client=local.client()){
 const address=email()
 const result=await client.auth.signUp({email:address,password,options:{emailRedirectTo:local.frontend,data:{whatsapp:'+5511999990000',...(name===undefined?{}:{username:name})}}})
 return {result,client,email:address}
}
async function confirm(account){
 let link
 for(let i=0;i<20&&!link;i++){
  const list=await(await local.fetch(`${local.mail}/api/v1/messages`)).json()
  const m=list.messages?.find(m=>m.To?.some(to=>to.Address===account.email))
  if(m){const d=await(await local.fetch(`${local.mail}/api/v1/message/${m.ID}`)).json();link=((d.Text||d.HTML).match(/https?:\/\/[^\s"<>]+/g)||[]).map(x=>x.replaceAll('&amp;','&')).find(x=>x.includes('/auth/v1/verify?'))}
  if(!link)await new Promise(r=>setTimeout(r,500))
 }
 check(Boolean(link),'local confirmation email received')
 const response=await local.fetch(link),tokens=new URLSearchParams(localUrl(response.headers.get('location'),'frontend').hash.slice(1))
 check(!(await account.client.auth.setSession({access_token:tokens.get('access_token'),refresh_token:tokens.get('refresh_token')})).error,'confirmed local session established')
}
try{
 for(const bad of [undefined,'','ab','ADMIN','inválido','a'.repeat(25),'a.b',true]){
  const attempt=await signup(bad)
  check(Boolean(attempt.result.error)&&!attempt.result.data.user,'direct signup without valid username rejected')
 }
 const name=username()
 const race=await Promise.all([signup(' '+name.toUpperCase()+' '),signup(name)])
 const winners=race.filter(a=>!a.result.error&&a.result.data.user),losers=race.filter(a=>a.result.error)
 check(winners.length===1&&losers.length===1,'concurrent normalized duplicate signup has exactly one winner')
 check(losers[0].result.error.status===500,'race loser returns server rejection rather than HTTP 429 rate limit')
 // Values interpolated below are locally generated UUID-based synthetic addresses only.
 if(!race.every(a=>/^selah-username-[0-9a-f-]+@example\.invalid$/.test(a.email)))throw Error('Invalid synthetic address')
 const count=local.psql(`begin read only; select count(*) as synthetic_race_rows from auth.users where email in ('${race[0].email}','${race[1].email}'); rollback;`)
 check(/\n\s*1\s*\r?\n/.test(count),'losing Auth row rolled back without orphan account')
 const first=winners[0]
 check(!first.result.data.session,'new signup still requires email confirmation')
 check((await first.client.auth.signInWithPassword({email:first.email,password})).error?.code==='email_not_confirmed','username does not bypass confirmation')
 await confirm(first)
 const repo=createUsernameRepository(first.client)
 check((await repo.load(first.result.data.user.id))?.username===name,'PostgreSQL stores canonical normalized username')
 const second=await signup(username())
 check(!second.result.error,'second valid distinct signup succeeds')
 await confirm(second)
 const other=await second.client.from('account_usernames').select('*').eq('user_id',first.result.data.user.id)
 check(!other.error&&other.data.length===0,'other user username association hidden by direct API')
 const publicLookup=await local.client().from('account_usernames').select('*')
 check(publicLookup.error?.code==='42501','anonymous username lookup denied')
 const columns=await first.client.from('account_usernames').select('*')
 check(!columns.error&&columns.data.length===1&&Object.keys(columns.data[0]).sort().join(',')==='user_id,username','username table exposes no email or other personal columns')
 const forge=await second.client.from('account_usernames').insert({user_id:first.result.data.user.id,username:username()})
 check(forge.error?.code==='42501','forged identity insert denied by RLS')
 const change=await first.client.from('account_usernames').update({username:username()}).eq('user_id',first.result.data.user.id)
 check(change.error?.code==='42501','username update prohibited')
 const metadata=await first.client.auth.updateUser({data:{username:username()}})
 check(!metadata.error&&(await repo.load(first.result.data.user.id))?.username===name,'editable Auth metadata cannot change authoritative username')
 check((await first.client.rpc('devotional_open_counts')).error?.code==='42501','username grants no admin privileges')
 check(!(await first.client.auth.signOut()).error&&!(await first.client.auth.signInWithPassword({email:first.email,password})).error,'email login persists after username registration')
 check((await repo.load(first.result.data.user.id))?.username===name,'username persists after new login')
 check(Boolean((await first.client.auth.signInWithPassword({email:name,password})).error),'username login not implemented')
 check(!(await first.client.auth.signOut()).error&&!(await second.client.auth.signOut()).error,'synthetic sessions signed out')
 console.log(`${passed} username HTTP checks passed. Two synthetic confirmed accounts retained; no deletions or credentials printed.`)
}catch{console.error(`Username validation stopped at ${stage}; ${passed} checks passed. Remaining checks NOT executed.`);process.exitCode=1}
