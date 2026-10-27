import { openLocalEnvironment, validateLocalEnvironment, localUrl } from './local-environment.mjs'

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuid=value=>{if(typeof value!=='string'||!uuidPattern.test(value))throw Error('Exact Auth UUID required');return value.toLowerCase()}

export function ownerEnvironment(environment=process.env) {
  validateLocalEnvironment(environment)
  // Refuse credential-bearing overrides, including credentials intended for DEV.
  // No .env file is opened, no hosted credential is needed or passed to subprocesses.
  for(const [key,value] of Object.entries(environment)) {
    if(!value)continue
    if(/^(?:VITE_)?(?:STAGING|PROD|PRODUCTION)_.*SUPABASE|^(?:VITE_)?SUPABASE_.*(?:KEY|TOKEN|SECRET|PASSWORD)$|^(?:VITE_)?DEV_SUPABASE_.*(?:KEY|TOKEN|SECRET|PASSWORD)$|^(?:SERVICE_ROLE_KEY|ANON_KEY|PUBLISHABLE_KEY|API_KEY|DATABASE_URL|SUPABASE_DB_URL|DB_URL|PGPASSWORD|PGPASSFILE|PGOPTIONS|NODE_OPTIONS)$/i.test(key))throw Error('Credential or runtime override refused')
    if(/^(?:VITE_)?DEV_SUPABASE_URL$/i.test(key))localUrl(value,'api',{root:true})
  }
  const safe={}
  for(const [key,value] of Object.entries(environment))if(/^(?:PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|PROGRAMDATA|HOMEDRIVE|HOMEPATH|DOCKER_HOST|DOCKER_CONTEXT|DOCKER_CONFIG)$/i.test(key))safe[key]=value
  // Preserve validated target overrides only long enough for openLocalEnvironment
  // to verify them. None supplies authentication or an alternative DB connection.
  for(const key of ['SUPABASE_URL','VITE_SUPABASE_URL','API_URL','PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGSERVICE','PGSERVICEFILE'])if(environment[key])safe[key]=environment[key]
  return safe
}
export function openOwnerEnvironment(environment=process.env) {
  return openLocalEnvironment({environment:ownerEnvironment(environment)})
}
export function parseOwnerArguments(args) {
  if(args.length===1 && args[0]==='--check-local')return {action:'check'}
  const [action,rawId,...tail]=args
  if(!['inspect','grant','revoke','transfer'].includes(action))throw Error('Explicit action required')
  const userId=uuid(rawId)
  if(action==='inspect') {if(tail.length)throw Error('Unexpected argument');return {action,userId}}
  const nextId=action==='transfer'?uuid(tail.shift()):null
  const flags={}
  while(tail.length) {
    const key=tail.shift(),value=tail.shift()
    if(!['--confirm','--confirm-target','--audit-ref'].includes(key)||!value||flags[key])throw Error('Invalid or duplicated flag')
    flags[key]=value
  }
  if(uuid(flags['--confirm'])!==userId)throw Error('Exact confirmation required')
  if(action==='transfer' ? uuid(flags['--confirm-target'])!==nextId||nextId===userId : flags['--confirm-target']!==undefined)throw Error('Exact transfer confirmation required')
  if(!/^LOCAL-[A-Za-z0-9_-]{8,80}$/.test(flags['--audit-ref']??''))throw Error('Unique opaque local audit reference required')
  return {action,userId,nextId,auditRef:flags['--audit-ref']}
}
export function ownerOperationSql(request) {
  // Validate again at the SQL boundary; exported helpers cannot bypass CLI parsing.
  const {action,userId,nextId,auditRef}=parseOwnerArguments(request.action==='inspect'?[request.action,request.userId]:[
    request.action,request.userId,...(request.action==='transfer'?[request.nextId]:[]),
    '--confirm',request.userId,...(request.action==='transfer'?['--confirm-target',request.nextId]:[]),'--audit-ref',request.auditRef,
  ])
  if(action==='inspect')return `begin read only;
    select json_build_object('exists',exists(select 1 from auth.users where id='${userId}'),
      'eligible',exists(select 1 from auth.users u join private.admin_users a on a.user_id=u.id
        where u.id='${userId}' and u.email_confirmed_at is not null and u.deleted_at is null
        and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=clock_timestamp())),
      'is_owner',exists(select 1 from private.app_owner where user_id='${userId}'),
      'owner_count',(select count(*) from private.app_owner)); rollback;`
  const target=action==='transfer'?nextId:userId
  const mutation=action==='grant'?`insert into private.app_owner(user_id) values('${userId}');`:
    action==='revoke'?`delete from private.app_owner where user_id='${userId}';`:
      `update private.app_owner set user_id='${nextId}' where user_id='${userId}';`
  return `begin;
    set local lock_timeout='5s';
    set local statement_timeout='15s';
    lock table private.app_owner in exclusive mode;
    lock table private.admin_users in share mode;
    do $owner_operator$ begin
      if ${action==='grant'?'exists(select 1 from private.app_owner)':`not exists(select 1 from private.app_owner where user_id='${userId}')`} then
        raise exception 'Owner state differs from explicit expectation' using errcode='42501';
      end if;
      ${action==='revoke'?'':`perform 1 from auth.users u join private.admin_users a on a.user_id=u.id
        where u.id='${target}' and u.email_confirmed_at is not null and u.deleted_at is null
        and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share of u;
      if not found then raise exception 'Confirmed active editorial account required' using errcode='42501';end if;`}
      ${mutation}
      insert into private.owner_provision_audit(action,previous_user_id,next_user_id,audit_ref)
        values('${action}',${action==='grant'?'null':`'${userId}'`},${action==='revoke'?'null':`'${target}'`},'${auditRef}');
    end $owner_operator$;
    commit;`
}
export function runOwnerOperation(local,request) {
  const output=local.psql(ownerOperationSql(request))
  if(request.action==='inspect') {
    const line=output.split(/\r?\n/).find(s=>s.trim().startsWith('{'))
    const state=JSON.parse(line??'null')
    if(!state||![state.exists,state.eligible,state.is_owner].every(v=>typeof v==='boolean')||![0,1].includes(state.owner_count))throw Error('Invalid local inspection')
    return {exists:state.exists,eligible:state.eligible,is_owner:state.is_owner,owner_count:state.owner_count}
  }
  return null
}
