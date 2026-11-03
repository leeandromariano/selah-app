import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { localDocker } from './local-docker.mjs'

if (process.argv.length !== 3 || process.argv[2] !== '--run-disposable') throw Error('Explicit --run-disposable required')
const docker = localDocker(), runId = randomUUID(), name = 'selah-editorial-p115-' + runId
const image = 'public.ecr.aws/supabase/postgres:17.11.0.006'
let id = ''
function command(args, opts = {}) {
  const r = docker.run(args, { encoding:'utf8', timeout:20000, ...opts })
  if (r.status !== 0) throw Error('Command failed: ' + (r.stderr || '').slice(-1200))
  return (r.stdout || '').trim()
}
function verify() {
  if (!/^[a-f0-9]{64}$/.test(id)) throw Error('Invalid container ID')
  const c = JSON.parse(command(['inspect','--format','{{json .}}',id]))
  if (c.Name !== '/'+name || c.Config.Labels?.['selah.editorial.run'] !== runId || c.Config.Image !== image || c.HostConfig.NetworkMode !== 'none' || c.Mounts.length || Object.keys(c.HostConfig.Tmpfs || {}).join() !== '/tmp') throw Error('Isolation verification failed')
}
const args = () => ['exec','-i',id,'psql','-X','-qAt','-h','/tmp','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
function sql(source, label) {
  verify()
  const r = docker.run(args(),{input:source,encoding:'utf8',timeout:20000})
  if (r.status !== 0) throw Error(label+': '+(r.stderr || '').slice(-1800))
  if (label === 'editorial assertions') { const count=(r.stderr.match(/NOTICE:\s+(?:00000:\s+)?PASS:/g)||[]).length; if(count<38)throw Error('Expected at least 38 passing SQL assertions, got '+count); console.log(label+': '+count+' passed') }
  else console.log(label+': PASS')
  return r.stdout.trim()
}
function start(statement, marker) {
  verify()
  const child = spawn('docker',['--host',docker.env.DOCKER_HOST,...args()],{env:docker.env,stdio:['pipe','pipe','pipe']})
  let output='', errors=''
  const closed = new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>resolve({code,output,errors}))})
  child.stdout.on('data',chunk=>{output+=chunk.toString()})
  child.stderr.on('data',chunk=>{errors+=chunk.toString()})
  child.stdin.end(statement)
  const ready = marker === 'unused' ? Promise.resolve() : (async()=>{for(let i=0;i<100;i++){if(output.includes(marker))return;if(child.exitCode!==null)throw Error('Exited before marker: '+errors.slice(-800));await new Promise(resolve=>setTimeout(resolve,50))}throw Error('Marker timed out')})()
  return {ready,closed}
}
async function waitForLock(tag) {
  for(let i=0;i<50;i++){
    const v=command([...args(),'-c',"select exists(select 1 from pg_stat_activity where application_name='"+tag+"' and wait_event_type='Lock')"])
    if(v==='t')return
    await new Promise(resolve=>setTimeout(resolve,50))
  }
  throw Error('Expected lock wait not observed: '+tag)
}
const bootstrap = [
"create role anon nologin; create role authenticated nologin; create role service_role nologin;",
"create schema auth; create schema extensions; create extension pgcrypto with schema extensions;",
"create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,raw_user_meta_data jsonb default '{}'::jsonb,created_at timestamptz default now());",
"create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
"create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;",
"grant usage on schema auth to public; grant execute on all functions in schema auth to public;"
].join('\n')
const seed = [
"set session_replication_role=replica;",
"insert into auth.users(id,email_confirmed_at) values ('11000000-0000-4000-8000-000000000001',now()),('11000000-0000-4000-8000-000000000002',now()),('11000000-0000-4000-8000-000000000003',now());",
"set session_replication_role=origin;",
"insert into private.app_owner(user_id) values ('11000000-0000-4000-8000-000000000001');"
].join('\n')
const ownerId='11000000-0000-4000-8000-000000000001',readerA='11000000-0000-4000-8000-000000000002',readerB='11000000-0000-4000-8000-000000000003'
const actor = user => "set local role authenticated; select set_config('request.jwt.claim.sub','"+user+"',true);"
const createTheme = slug => "select public.owner_editorial_change('create_theme','{\"name\":\""+slug+"\",\"slug\":\""+slug+"\"}');"
const request = user => "insert into public.account_deletion_requests(user_id) values ('"+user+"');"
const begin = tag => "set application_name='"+tag+"'; begin; set local lock_timeout='8s';"
const hold = "select 'HELD'; select pg_sleep(3);"
async function complete(tx, expected, label) {
  const r=await tx.closed
  if(expected==='ok' && r.code!==0)throw Error(label+': '+r.errors.slice(-1200))
  if(expected!=='ok' && (r.code===0 || !r.errors.includes(expected)))throw Error(label+': expected '+expected+' got '+r.errors.slice(-1000))
  console.log(label+': PASS'+(expected==='ok'?'':' SQLSTATE '+expected))
}
async function waitAndFinish(first,second,tag,expected,label) {
  await waitForLock(tag)
  await complete(first,'ok',label+' primeira transacao')
  await complete(second,expected,label+' segunda transacao')
}
try {
  const files=readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()
  if(files.length!==16||files.some(n=>/editorial_structure/i.test(n)))throw Error('Unexpected official migrations')
  id=command(['run','--detach','--rm','--pull=never','--network','none','--name',name,'--label','selah.editorial.run='+runId,'--tmpfs','/tmp:rw,mode=1777','--user','postgres','--entrypoint','sh',image,'-c','initdb -D /tmp/editorial-db -A trust -U postgres >/dev/null && exec postgres -D /tmp/editorial-db -c listen_addresses= -c unix_socket_directories=/tmp'])
  verify()
  let ready=false
  for(let i=0;i<50;i++){if(docker.run(['exec',id,'pg_isready','-h','/tmp','-U','postgres'],{encoding:'utf8'}).status===0){ready=true;break}await new Promise(resolve=>setTimeout(resolve,200))}
  if(!ready)throw Error('Database startup failed')
  sql(bootstrap,'synthetic auth bootstrap')
  for(const file of files)sql(readFileSync('supabase/migrations/'+file,'utf8'),file)
  const candidate=readFileSync('docs/proposals/sql/NAO_APLICAR_20261028001000_editorial_structure.sql','utf8')
  if(candidate.includes('lock table public.account_deletion_requests in share mode')||!candidate.includes('create trigger editorial_deletion_identity_lock'))throw Error('Unexpected identity candidate')
  sql(candidate,'isolated identity candidate')
  sql(readFileSync('supabase/tests/editorial_structure.sql','utf8'),'editorial assertions')
  sql(seed,'concurrency fixtures')

  let a=start(begin('p115_a')+actor(ownerId)+createTheme('scenario-a')+hold+'rollback;','HELD')
  await a.ready
  sql(begin('p115_b')+actor(readerA)+request(readerA)+'commit;','A unrelated deletion completes while editorial open')
  if(sql("select exists(select 1 from pg_stat_activity where application_name='p115_a' and state='active');",'A editorial still active')!=='t')throw Error('A was not open')
  await complete(a,'ok','A editorial rollback')

  a=start(begin('p115_bfirst')+actor(readerB)+request(readerB)+hold+'rollback;','HELD')
  await a.ready
  sql(begin('p115_after_b')+actor(ownerId)+createTheme('scenario-b')+'commit;','B editorial completes while unrelated request open')
  if(sql("select exists(select 1 from pg_stat_activity where application_name='p115_bfirst' and state='active');",'B request still active')!=='t')throw Error('B was not open')
  await complete(a,'ok','B request rollback')

  a=start(begin('p115_cfirst')+actor(ownerId)+createTheme('scenario-c')+hold+'commit;','HELD')
  await a.ready
  let b=start(begin('p115_cwait')+actor(ownerId)+request(ownerId)+'commit;','unused')
  await waitAndFinish(a,b,'p115_cwait','ok','C same owner')
  sql("delete from public.account_deletion_requests where user_id='"+ownerId+"';",'C clear fixture')

  a=start(begin('p115_dfirst')+actor(ownerId)+request(ownerId)+hold+'commit;','HELD')
  await a.ready
  b=start(begin('p115_dwait')+actor(ownerId)+createTheme('scenario-d')+'commit;','unused')
  await waitAndFinish(a,b,'p115_dwait','42501','D deletion before editorial')
  sql("delete from public.account_deletion_requests where user_id='"+ownerId+"';",'D clear fixture')

  a=start(begin('p115_rollback')+actor(ownerId)+request(ownerId)+hold+'rollback;','HELD')
  await a.ready
  b=start(begin('p115_rollbackwait')+actor(ownerId)+createTheme('scenario-rollback')+'commit;','unused')
  await waitAndFinish(a,b,'p115_rollbackwait','ok','E deletion rollback')

  a=start(begin('p115_revoke')+"delete from private.app_owner where user_id='"+ownerId+"';"+hold+'commit;','HELD')
  await a.ready
  b=start(begin('p115_revokewait')+actor(ownerId)+createTheme('scenario-revoke')+'commit;','unused')
  await waitAndFinish(a,b,'p115_revokewait','42501','E owner revocation')
  sql("insert into private.app_owner(user_id) values ('"+ownerId+"');",'E restore owner fixture')

  a=start(begin('p115_suspend')+"update auth.users set banned_until=now()+interval '1 day' where id='"+ownerId+"';"+hold+'commit;','HELD')
  await a.ready
  b=start(begin('p115_suspendwait')+actor(ownerId)+createTheme('scenario-suspend')+'commit;','unused')
  await waitAndFinish(a,b,'p115_suspendwait','42501','E owner suspension')
  sql("update auth.users set banned_until=null where id='"+ownerId+"';",'E restore suspension fixture')


  a=start(begin('p115_edit_suspend_first')+actor(ownerId)+createTheme('scenario-edit-suspend')+hold+'commit;','HELD')
  await a.ready
  b=start(begin('p115_suspend_after')+"update auth.users set banned_until=now()+interval '1 day' where id='"+ownerId+"';commit;",'unused')
  await waitAndFinish(a,b,'p115_suspend_after','ok','E editorial before suspension')
  sql("update auth.users set banned_until=null where id='"+ownerId+"';",'E restore second suspension')

  a=start(begin('p115_edit_revoke_first')+actor(ownerId)+createTheme('scenario-edit-revoke')+hold+'commit;','HELD')
  await a.ready
  b=start(begin('p115_revoke_after')+"delete from private.app_owner where user_id='"+ownerId+"';commit;",'unused')
  await waitAndFinish(a,b,'p115_revoke_after','ok','E editorial before revocation')
  sql("insert into private.app_owner(user_id) values ('"+ownerId+"');",'E restore second owner')
  a=start(begin('p115_forged')+actor(ownerId)+createTheme('scenario-forged')+hold+'rollback;','HELD')
  await a.ready
  b=start(begin('p115_forgedwait')+actor(readerB)+request(ownerId)+'commit;','unused')
  await complete(b,'42501','E forged deletion denied before lock')
  if(sql("select exists(select 1 from pg_stat_activity where application_name='p115_forged' and state='active');",'E owner still active')!=='t')throw Error('Forgery not tested while owner open')
  await complete(a,'ok','E editorial rollback')

  sql("do $$ begin if exists(select 1 from private.editorial_themes where slug in ('scenario-a','scenario-d','scenario-revoke','scenario-suspend','scenario-forged')) or exists(select 1 from public.account_deletion_requests where user_id='"+ownerId+"') or (select count(*) from private.editorial_themes where slug in ('scenario-b','scenario-c','scenario-rollback','scenario-edit-suspend','scenario-edit-revoke'))<>5 or not exists(select 1 from public.account_deletion_requests where user_id='"+readerA+"') or exists(select 1 from public.account_deletion_requests where user_id='"+readerB+"') then raise exception 'unexpected final state'; end if; end $$;",'F final state and rollback')

  a=start(begin('p115_cascade_first')+"select 1 from auth.users where id='"+readerA+"' for update;"+hold+"delete from auth.users where id='"+readerA+"'; rollback;",'HELD')
  await a.ready
  b=start(begin('p115_cancel_wait')+"delete from public.account_deletion_requests where user_id='"+readerA+"'; rollback;",'unused')
  await complete(b,'ok','Privileged cancellation independent of auth row lock')
  if(sql("select exists(select 1 from pg_stat_activity where application_name='p115_cascade_first' and state='active');",'Physical deletion still open')!=='t')throw Error('Operations did not overlap')
  await complete(a,'ok','Physical deletion after cancellation rollback')
  b=start("update public.account_deletion_requests set user_id='"+readerB+"' where user_id='"+readerA+"';",'unused')
  await complete(b,'23514','Deletion request identity is immutable')
  sql("begin; delete from auth.users where id='"+readerA+"'; do $$ begin if exists(select 1 from public.account_deletion_requests where user_id='"+readerA+"') then raise exception 'cascade failed'; end if; end $$; rollback;",'F physical deletion and cascade rollback')
  sql("insert into public.devotionals(id,title,bible_reference,bible_text,content,reflection_question,status,publish_at,author_id) values ('21000000-0000-4000-8000-000000000001','Synthetic','x','x','x','x','draft',now(),'"+ownerId+"');",'F synthetic authorship')
  b=start("delete from auth.users where id='"+ownerId+"';",'unused')
  await complete(b,'23503','F author deletion restricted')
  sql("do $$ begin if not exists(select 1 from auth.users where id='"+ownerId+"') or not exists(select 1 from public.devotionals where author_id='"+ownerId+"') then raise exception 'partial delete'; end if; end $$;",'F restricted deletion preserved state')
} finally {
  if(id){try{verify();command(['stop','--time','5',id]);console.log('Cleanup: verified disposable container stopped')}catch(error){console.error('Cleanup failed for label '+runId+': '+error.message);process.exitCode=1}}
}
