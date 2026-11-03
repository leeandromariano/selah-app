import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { pathToFileURL } from 'node:url'
import { localDocker } from './local-docker.mjs'

if (process.argv.length !== 3 || process.argv[2] !== '--run-disposable') throw Error('Explicit --run-disposable required')
const docker=localDocker()
const id='selahp115'+randomBytes(8).toString('hex')
const temp=mkdtempSync(path.join(tmpdir(),'selah-p115-'))
const cli=path.resolve('node_modules/supabase/dist/supabase.js')
let attempted=false
const cleanEnv={...docker.env}
for (const k of Object.keys(cleanEnv)) if (/^(SUPABASE_|VITE_|PG|SELAH_)/i.test(k)) delete cleanEnv[k]
cleanEnv.DOCKER_HOST=docker.env.DOCKER_HOST
function d(args) {
  const r=docker.run(args,{encoding:'utf8',timeout:20000})
  if(r.status!==0)throw Error('Docker preflight failed')
  return r.stdout
}
function resources() {
  return [d(['ps','-a','--format','{{.Names}}']),d(['volume','ls','--format','{{.Name}}']),d(['network','ls','--format','{{.Name}}'])].join('\n').split(/\r?\n/).filter(x=>x.includes(id))
}
function cliRun(args, timeout=180000) {
  return spawnSync(process.execPath,[cli,...args,'--workdir',temp],{env:cleanEnv,encoding:'utf8',timeout,maxBuffer:4*1024*1024})
}
async function freePort() {
  return await new Promise((resolve,reject)=>{
    const server=net.createServer().once('error',reject).listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port))})
  })
}
try {
  if(resources().length)throw Error('Unique project name collision')
  const ports=new Set()
  while(ports.size<3)ports.add(await freePort())
  const [api,db,shadow]=ports
  mkdirSync(path.join(temp,'supabase','migrations'),{recursive:true})
  const cfg=['project_id = "'+id+'"','[api]','enabled = true','port = '+api,'schemas = ["public"]','extra_search_path = ["public", "extensions"]','[db]','port = '+db,'shadow_port = '+shadow,'major_version = 17','[db.seed]','enabled = false','[studio]','enabled = false','[analytics]','enabled = false','[storage]','enabled = false','[realtime]','enabled = false','[auth]','enabled = true','site_url = "http://127.0.0.1:'+api+'"','enable_signup = true','[auth.email]','enable_signup = true','enable_confirmations = false',''].join('\n')
  writeFileSync(path.join(temp,'supabase','config.toml'),cfg)
  const files=readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()
  if(files.length!==16||files.some(n=>/editorial_structure/i.test(n)))throw Error('Official migration inventory mismatch')
  for(const file of files)writeFileSync(path.join(temp,'supabase','migrations',file),readFileSync(path.join('supabase/migrations',file)))

  const candidate=readFileSync('docs/proposals/sql/NAO_APLICAR_20261028001000_editorial_structure.sql','utf8')
  writeFileSync(path.join(temp,'supabase','migrations','20261028001000_editorial_structure.sql'),candidate)
  console.log('Preflight: local Docker, unique project, temporary storage, independent ports, no remote link or credentials')
  attempted=true
  const start=cliRun(['start','--exclude','realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor'])
  if(start.status!==0) {
    const msg=(start.stderr||'')+'\n'+(start.stdout||'')
    const lines=msg.split(/\r?\n/).filter(x=>/error|failed|unable|cannot|unhealthy|port is already|connection refused|not found|not running|permission denied|timeout|pull access denied|no such host|migration/i.test(x)).map(x=>x.replace(/(password|token|key|secret|authorization|postgres(?:ql)?:\/\/)[^\s]*/ig,'[redacted]').replace(/https?:\/\/\S+/g,'[url]').slice(0,280)).slice(-8)
    console.log('Supabase CLI startup: FAILED; code '+start.status+'; '+(start.error?.code||''))
    for(const line of lines)console.log('diagnostic: '+line)
    throw Error('Real local stack unavailable')
  }
  console.log('Supabase CLI startup: PASS with official migrations and isolated candidate')
  const status=cliRun(['status','--output','json'],30000)
  if(status.status!==0)throw Error('Cannot obtain ephemeral status')
  const info=JSON.parse(status.stdout)
  const apiUrl=info.API_URL
  if(!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(apiUrl))throw Error('Unexpected API host')
  if(!info.ANON_KEY)throw Error('Ephemeral API key unavailable')
  const r=await fetch(apiUrl+'/auth/v1/health',{headers:{apikey:info.ANON_KEY},signal:AbortSignal.timeout(10000)})
  console.log('Auth HTTP health: '+r.status)
  if(!r.ok)throw Error('Auth local health failed')

  const base=apiUrl
  const password='P115-'+randomBytes(18).toString('hex')+'aA9!'
  async function call(route, { token, method='GET', body, headers={} }={}) {
    const h={apikey:info.ANON_KEY,...headers}
    if(token)h.Authorization='Bearer '+token
    if(body!==undefined)h['Content-Type']='application/json'
    const response=await fetch(base+route,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)})
    const raw=await response.text()
    let json
    try{json=JSON.parse(raw)}catch{json=null}
    return {status:response.status,json,raw}
  }
  async function signup(name) {
    const email=name+'@example.com'
    const signupResult=await call('/auth/v1/signup',{method:'POST',body:{email,password,data:{username:'p115_'+name,whatsapp:'+15550000001'}}})
    if(signupResult.status!==200 && signupResult.status!==201)throw Error('Auth signup '+name+' HTTP '+signupResult.status+' code '+(signupResult.json?.code||'unknown'))
    const login=await call('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}})
    if(login.status!==200 || !login.json?.access_token || !/^[a-f0-9-]{36}$/.test(login.json.user?.id||''))throw Error('Auth login '+name+' HTTP '+login.status)
    console.log('Auth signup/login '+name+': HTTP '+login.status)
    return {id:login.json.user.id, token:login.json.access_token}
  }
  const owner=await signup('owner'), reader=await signup('reader')
  const dbName='supabase_db_'+id
  const dbInspect=JSON.parse(d(['inspect','--format','{{json .}}',dbName]))
  if(dbInspect.Name!=='/'+dbName || !String(dbInspect.Config.Image).includes('supabase/postgres'))throw Error('Unexpected temporary database identity')
  function sql(query,label) {
    const result=docker.run(['exec','-i',dbName,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',timeout:20000})
    if(result.status!==0)throw Error(label+' SQL failed: '+(result.stderr||'').replace(/(password|token|secret)[^\\s]*/ig,'[redacted]').slice(-500))
    console.log(label+': PASS')
  }
  sql("insert into private.app_owner(user_id) values ('"+owner.id+"'); "+
    "insert into public.devotionals(id,title,bible_reference,bible_text,content,reflection_question,status,publish_at,author_id) values "+
    "('31000000-0000-4000-8000-000000000001','Visible sample','R','T','C','Q','published',now()-interval '1 hour','"+owner.id+"'),"+
    "('31000000-0000-4000-8000-000000000002','Hidden draft sample','R','T','C','Q','draft',now(),'"+owner.id+"'),"+
    "('31000000-0000-4000-8000-000000000003','Hidden future sample','R','T','C','Q','published',now()+interval '1 day','"+owner.id+"');", 'Synthetic fixture seed')
  const change=(actor,action,data)=>call('/rest/v1/rpc/owner_editorial_change',{token:actor.token,method:'POST',body:{p_action:action,p_data:data}})
  let result=await change(reader,'create_theme',{name:'Forbidden',slug:'forbidden'})
  if(result.status!==403||result.json?.code!=='42501')throw Error('Reader owner operation: HTTP '+result.status+' code '+result.json?.code)
  console.log('Reader owner mutation denied: HTTP 403 SQLSTATE 42501')
  result=await change(owner,'create_theme',{name:'Hope',slug:'hope'})
  if(result.status!==200 || !result.json?.id)throw Error('Owner create theme: HTTP '+result.status+' code '+result.json?.code)
  const theme=result.json.id
  result=await change(owner,'create_series',{title:'Series sample',slug:'series-sample',available:true})
  if(result.status!==200||!result.json?.id)throw Error('Owner create series: HTTP '+result.status+' code '+result.json?.code)
  const series=result.json.id
  for(const [idx,pos] of [[1,1],[2,2],[3,3]]) {
    const devotional='31000000-0000-4000-8000-00000000000'+idx
    for(const [action,data] of [['attach_theme',{devotional_id:devotional,theme_id:theme}],['attach_episode',{devotional_id:devotional,series_id:series,position:pos}]]) {
      const v=await change(owner,action,data);if(v.status!==200)throw Error('Owner '+action+' HTTP '+v.status+' code '+v.json?.code)
    }
  }
  console.log('Eligible OWNER create/associate: HTTP 200')
  async function catalog(kind,slug=null,page=0,size=25) {
    return call('/rest/v1/rpc/reader_editorial_catalog',{token:reader.token,method:'POST',body:{p_kind:kind,p_slug:slug,p_page:page,p_size:size}})
  }
  for(const [kind,slug] of [['themes',null],['series',null],['series_detail','series-sample'],['episodes','series-sample'],['devotionals','hope']]) {
    const v=await catalog(kind,slug)
    if(v.status!==200)throw Error('Catalog '+kind+' HTTP '+v.status+' code '+v.json?.code)
    if(/Hidden draft sample|Hidden future sample|sort_position|"position"|count/i.test(v.raw))throw Error('Catalog exposed hidden metadata: '+kind)
    if((kind==='episodes'||kind==='devotionals')&&(!Array.isArray(v.json)||v.json.length!==1||v.json[0].title!=='Visible sample'))throw Error('Catalog visibility mismatch: '+kind)
    console.log('Reader '+kind+': HTTP 200, no hidden titles or positions')
  }

  const repositoryPath=path.resolve('src/editorial/catalogRepository.ts')
  const { createEditorialReaderSource }=await import(pathToFileURL(repositoryPath).href)
  const transport={rpc:(_name,args)=>({abortSignal:async signal=>{
    const response=await fetch(base+'/rest/v1/rpc/reader_editorial_catalog',{method:'POST',headers:{apikey:info.ANON_KEY,Authorization:'Bearer '+reader.token,'Content-Type':'application/json'},body:JSON.stringify(args),signal})
    return {data:await response.json(),error:response.ok?null:{status:response.status}}
  }})}
  const adapted=createEditorialReaderSource(transport), signal=new AbortController().signal
  const [adaptedThemes,adaptedSeries,adaptedEpisodes,adaptedDevotionals,adaptedDetail,adaptedSeriesDevotionals]=await Promise.all([
    adapted.themes(0,signal),adapted.series(0,signal),adapted.episodes('series-sample',0,signal),
    adapted.themeDevotionals('hope',0,signal),adapted.seriesDetail('series-sample',signal),adapted.seriesDevotionals('series-sample',0,signal)])
  if(adaptedThemes.items[0]?.slug!=='hope'||adaptedSeries.items[0]?.slug!=='series-sample'||adaptedDetail?.slug!=='series-sample'||adaptedEpisodes.items.length!==1||adaptedDevotionals.items.length!==1||adaptedSeriesDevotionals.items.length!==1)throw Error('Real adapter projection mismatch')
  console.log('Frontend catalogRepository with real HTTP/Auth: PASS (6 methods)')
  result=await catalog('episodes','series-sample',1,1)
  if(result.status!==200||!Array.isArray(result.json)||result.json.length!==0)throw Error('Pagination mismatch')
  console.log('Reader pagination: HTTP 200')
  result=await catalog('themes',null,0,0)
  if(result.status!==400||result.json?.code!=='22023')throw Error('Invalid pagination: HTTP '+result.status+' code '+result.json?.code)
  console.log('Invalid pagination denied: HTTP 400 SQLSTATE 22023')
  result=await call('/rest/v1/editorial_themes',{token:reader.token,headers:{'Accept-Profile':'private'}})
  if(result.status<400)throw Error('Private schema exposed')
  console.log('Private schema denied by Data API: HTTP '+result.status)
  sql("do $$ begin if has_table_privilege('authenticated','private.editorial_themes','select') or has_function_privilege('authenticated','private.editorial_owner_lock()','execute') or has_function_privilege('authenticated','private.editorial_deletion_identity_lock()','execute') then raise exception 'excessive privilege'; end if; end $$;",'Effective DB grants')

  sql("do $$ declare f regprocedure; begin foreach f in array array['public.owner_editorial_change(text,jsonb)'::regprocedure,'public.reader_editorial_catalog(text,text,integer,integer)'::regprocedure,'private.editorial_owner_lock()'::regprocedure,'private.editorial_deletion_identity_lock()'::regprocedure] loop if not exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_roles r on r.oid=p.proowner where p.oid=f and r.rolname='postgres' and p.prosecdef and array_to_string(p.proconfig,',') like 'search_path=%') then raise exception 'unexpected function ownership or configuration'; end if; end loop; if exists(select 1 from pg_catalog.pg_roles where rolname in ('anon','authenticated') and rolcanlogin) then raise exception 'API role can login'; end if; end $$;",'Function ownership, SECURITY DEFINER, search_path and API NOLOGIN')
  sql("update auth.users set email_confirmed_at=null where id='"+owner.id+"';",'Synthetic unconfirmed owner')
  result=await change(owner,'create_theme',{name:'Unconfirmed',slug:'unconfirmed'})
  if(result.status!==403||result.json?.code!=='42501')throw Error('Unconfirmed owner: HTTP '+result.status+' code '+result.json?.code)
  console.log('Unconfirmed OWNER old session denied: HTTP 403 SQLSTATE 42501')
  sql("update auth.users set email_confirmed_at=now() where id='"+owner.id+"';",'Synthetic reconfirmation')
  sql("delete from private.app_owner where user_id='"+owner.id+"';",'Synthetic owner revocation')
  result=await change(owner,'create_theme',{name:'Revoked',slug:'revoked'})
  if(result.status!==403||result.json?.code!=='42501')throw Error('Revoked owner: HTTP '+result.status+' code '+result.json?.code)
  console.log('Revoked OWNER old session denied: HTTP 403 SQLSTATE 42501')
  sql("insert into private.app_owner(user_id) values ('"+owner.id+"');",'Synthetic owner restoration')
  sql("update auth.users set banned_until=now()+interval '1 day' where id='"+owner.id+"';",'Synthetic suspension')
  result=await change(owner,'create_theme',{name:'Suspended',slug:'suspended'})
  if(result.status!==403||result.json?.code!=='42501')throw Error('Suspended owner: HTTP '+result.status+' code '+result.json?.code)
  console.log('Suspended OWNER old session denied: HTTP 403 SQLSTATE 42501')
  sql("update auth.users set banned_until=null where id='"+owner.id+"';",'Synthetic reactivation')
  result=await call('/rest/v1/account_deletion_requests',{token:reader.token,method:'POST',body:{user_id:owner.id},headers:{Prefer:'return=minimal'}})
  if(result.status!==403||result.json?.code!=='42501')throw Error('Forged deletion: HTTP '+result.status+' code '+result.json?.code)
  console.log('Forged deletion request denied: HTTP 403 SQLSTATE 42501')
  result=await call('/rest/v1/account_deletion_requests',{token:owner.token,method:'POST',body:{user_id:owner.id},headers:{Prefer:'return=minimal'}})
  if(result.status!==201)throw Error('Owner deletion request: HTTP '+result.status+' code '+result.json?.code)
  console.log('OWNER deletion request: HTTP 201')
  result=await change(owner,'create_theme',{name:'Pending',slug:'pending'})
  if(result.status!==403||result.json?.code!=='42501')throw Error('Pending OWNER: HTTP '+result.status+' code '+result.json?.code)
  console.log('OWNER deletion pending denied: HTTP 403 SQLSTATE 42501')
  console.log('Real Auth and PostgREST subset: PASS; concurrency remains tested separately')

} finally {
  if(attempted){
    const before=resources()
    console.log('Temporary project resources before cleanup: '+before.length)
    const stop=cliRun(['stop','--project-id',id,'--no-backup'],60000)
    if(stop.status!==0)console.error('Cleanup CLI returned nonzero: '+stop.status)
    const after=resources()
    console.log('Temporary project resources after cleanup: '+after.length)
    if(stop.status!==0||after.length)process.exitCode=1
  }
  const real=path.resolve(temp)
  if(real.startsWith(path.resolve(tmpdir())+path.sep) && path.basename(real).startsWith('selah-p115-'))rmSync(real,{recursive:true,force:true})
  else { console.error('Temporary path verification failed'); process.exitCode = 1 }
}
