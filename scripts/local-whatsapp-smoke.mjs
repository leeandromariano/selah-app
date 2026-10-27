// Opt-in local integration only; retains synthetic accounts and sends no WhatsApp messages.
import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {prepareLocalScript,localUrl} from './local-environment.mjs'
import {setLocalAdmin} from './local-admin-tools.mjs'
import {createFeedbackRepository} from '../src/profiles/feedback.ts'
const local=prepareLocalScript()
if(process.argv[2]==='--sql'){
 try{process.stdout.write(local.psql(readFileSync('supabase/tests/whatsapp-feedback.sql','utf8')))}catch{console.error('WhatsApp SQL failed; validation incomplete. No credentials printed.');process.exit(1)}
 process.exit(0)
}
let passed=0,stage='setup',adminId
function check(ok,label){stage=label;if(!ok)throw Error('check failed');passed++;console.log('PASS '+label)}
const username=()=> 'u'+randomUUID().replaceAll('-','').slice(0,20)
const email=()=>`selah-whatsapp-${randomUUID()}@example.invalid`
const phone='+5511999990000',changed='+5511999990009',password=`Fiction-${randomUUID()}!`
async function signup(number,choice){const client=local.client(),address=email();const result=await client.auth.signUp({email:address,password,options:{emailRedirectTo:local.frontend,data:{username:username(),...(number===undefined?{}:{whatsapp:number}),...(choice===undefined?{}:{feedback_contact_allowed:choice})}}});return {client,email:address,result}}
async function confirm(account){
 let link
 for(let i=0;i<20&&!link;i++){
  const list=await(await local.fetch(`${local.mail}/api/v1/messages`)).json(),m=list.messages?.find(m=>m.To?.some(t=>t.Address===account.email))
  if(m){const d=await(await local.fetch(`${local.mail}/api/v1/message/${m.ID}`)).json();link=((d.Text||d.HTML).match(/https?:\/\/[^\s"<>]+/g)||[]).map(x=>x.replaceAll('&amp;','&')).find(x=>x.includes('/auth/v1/verify?'))}
  if(!link)await new Promise(r=>setTimeout(r,500))
 }
 check(Boolean(link),'local confirmation email delivered')
 const r=await local.fetch(link),tokens=new URLSearchParams(localUrl(r.headers.get('location'),'frontend').hash.slice(1))
 const claims=JSON.parse(Buffer.from(tokens.get('access_token').split('.')[1],'base64url').toString())
 check(!('whatsapp' in claims.user_metadata)&&!('feedback_contact_allowed' in claims.user_metadata)&&!JSON.stringify(claims).includes(phone),'confirmation JWT contains no new WhatsApp intake or choice')
 check(!(await account.client.auth.setSession({access_token:tokens.get('access_token'),refresh_token:tokens.get('refresh_token')})).error,'email confirmation establishes session')
 account.id=account.result.data.user.id;account.feedback=createFeedbackRepository(account.client)
}
try{
 for(const invalid of [undefined,'','11999990000','+0123456789','+551234',true]){const a=await signup(invalid);check(Boolean(a.result.error)&&!a.result.data.user,'direct signup cannot omit or forge WhatsApp')}
 const wrong=await signup(phone,'true');check(Boolean(wrong.result.error),'nonboolean contact authorization rejected')
 const first=await signup('+55 (11) 99999-0000')
 check(!first.result.error&&!first.result.data.session,'valid number without feedback choice permits signup, confirmation still required')
 await confirm(first)
 const second=await signup(phone,true);check(!second.result.error&&!second.result.data.session,'explicit optional opt-in permits signup');await confirm(second)
 const own=await first.client.from('profiles').select('*').eq('id',first.id).single()
 check(!own.error&&own.data.phone===phone&&own.data.whatsapp_required===true&&own.data.name===null&&own.data.instagram===null,'required WhatsApp persisted, personal fields optional')
 const initial=await first.feedback.load(first.id),authorized=await second.feedback.load(second.id)
 check(initial?.allowed===false&&Boolean(initial.decided_at),'omitted authorization defaults to false with server time')
 check(authorized?.allowed===true&&authorized.purpose_version==='feedback-v1','explicit authorization persisted separately')
 const noPhone=await first.client.from('profiles').update({phone:null}).eq('id',first.id)
 check(noPhone.error?.code==='23514','new profile cannot remove required phone via direct API')
 const flag=await first.client.from('profiles').update({whatsapp_required:false}).eq('id',first.id)
 check(flag.error?.code==='42501','client cannot disable required flag')
 const other=await first.client.from('profiles').select('phone').eq('id',second.id)
 check(!other.error&&other.data.length===0,'reader cannot retrieve other phone')
 const preference=await first.client.from('feedback_contact_preferences').select('*').eq('user_id',second.id)
 check(!preference.error&&preference.data.length===0,'reader cannot retrieve other contact choice')
 const forged=await first.client.rpc('set_feedback_contact',{p_user_id:second.id,p_expected_phone:phone,p_allowed:false})
 check(forged.error?.code==='42501','RPC cannot change another user choice')
 const raw=await first.client.from('feedback_contact_preferences').update({allowed:true,decided_at:'2000-01-01'}).eq('user_id',first.id)
 check(raw.error?.code==='42501','direct choice and timestamp writes denied')
 const anonymous=await local.client().from('profiles').select('phone')
 check(anonymous.error?.code==='42501','anonymous phone read denied')
 const anonymousChoice=await local.client().from('feedback_contact_preferences').select('*')
 check(anonymousChoice.error?.code==='42501','anonymous preference read denied')
 const opted=await first.feedback.save(first.id,phone,true)
 check(opted.allowed&&Boolean(opted.decided_at),'user may authorize explicitly after signup')
 const stale=await first.client.rpc('set_feedback_contact',{p_user_id:first.id,p_expected_phone:changed,p_allowed:true})
 check(stale.error?.code==='23514','stale or mismatched number cannot receive authorization')
 check(!(await first.client.from('profiles').update({phone:changed,name:'Apelido Fictício',instagram:'@ficticio'}).eq('id',first.id)).error,'own WhatsApp and optional fields editable')
 const revoked=await first.feedback.load(first.id)
 check(revoked?.allowed===false&&revoked.decided_at!==opted.decided_at,'changing number revokes old choice atomically with server time')
 check((await first.feedback.save(first.id,changed,true)).allowed,'new number requires new explicit authorization')
 check(!(await first.feedback.save(first.id,null,false)).allowed,'authorization can be withdrawn without matching number')
 setLocalAdmin(first.id,true);adminId=first.id
 const adminPhone=await first.client.from('profiles').select('phone').eq('id',second.id),adminChoice=await first.client.from('feedback_contact_preferences').select('*').eq('user_id',second.id)
 check(!adminPhone.error&&adminPhone.data.length===0,'admin membership grants no other phone access, even opted in')
 check(!adminChoice.error&&adminChoice.data.length===0,'admin membership grants no contact-choice directory')
 const metrics=await first.client.rpc('devotional_open_counts')
 check(!metrics.error&&metrics.data.every(row=>Object.keys(row).every(k=>['devotional_id','total_opens','unique_readers'].includes(k))),'administrative metrics contain no telephone columns')
 setLocalAdmin(first.id,false);adminId=undefined
 const editedMeta=await first.client.auth.updateUser({data:{whatsapp:phone,feedback_contact_allowed:true}})
 const user=await first.client.auth.getUser()
 check(!editedMeta.error&&!user.error&&!('whatsapp' in user.data.user.user_metadata)&&!('feedback_contact_allowed' in user.data.user.user_metadata),'Auth metadata cannot become stale telephone or authorization source')
 check(!(await first.client.auth.signOut()).error&&!(await first.client.auth.signInWithPassword({email:first.email,password})).error,'email login and logout preserved')
 const fresh=local.client(),session=(await first.client.auth.getSession()).data.session
 check(!(await fresh.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token})).error,'session restored into fresh client')
 const persisted=await fresh.from('profiles').select('phone,name,instagram').eq('id',first.id).single(),saved=await createFeedbackRepository(fresh).load(first.id)
 check(!persisted.error&&persisted.data.phone===changed&&persisted.data.name==='Apelido Fictício'&&saved?.allowed===false,'phone optional fields and withdrawal persist after reload and login')
 check(!(await first.client.auth.signOut()).error&&!(await second.client.auth.signOut()).error,'synthetic sessions signed out')
 console.log(`${passed} WhatsApp HTTP checks passed; two synthetic accounts retained, test admin revoked. No phone or credentials printed.`)
}catch{console.error(`WhatsApp validation stopped at ${stage}; ${passed} checks passed. Remaining checks NOT executed.`);process.exitCode=1}
finally{if(adminId){try{setLocalAdmin(adminId,false)}catch{console.error('Synthetic local grant revocation failed; operator review required.');process.exitCode=1}}}
