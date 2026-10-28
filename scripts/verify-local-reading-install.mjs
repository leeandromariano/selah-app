// Opt-in audit only. Reuse a LOCAL image, never pull, attach volumes, or reset.
// The existing stack is read only (metadata + Auth DDL, never table data).
import { readFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { prepareLocalScript } from './local-environment.mjs'
const local = prepareLocalScript()
const docker = local.docker
const runId = randomUUID()
const name = 'selah-reading-audit-' + runId
const migrations = [
  '20261023000100_initial_schema.sql',
  '20261026000100_privacy_essential.sql',
  '20261026000200_account_usernames.sql',
  '20261026000300_bind_username_claim.sql',
  '20261026000400_whatsapp_feedback.sql',
  '20261026000500_whatsapp_intake_metadata.sql',
  '20261027000100_password_login_limits.sql',
  '20261028000100_reading_completions.sql',
  '20261028000200_reading_claims_access.sql',
  '20261028000300_reader_consistency.sql',
  '20261028000400_owner_community.sql',
  '20261028000500_owner_provision_audit.sql',
  '20261028000600_smart_reminders.sql',
  '20261028000700_discussion.sql',
  '20261028000800_personal_achievements.sql',
  '20261028000900_owner_eligibility_staging_audit.sql',
]
const suites = ['authorization','privacy-essential','usernames','whatsapp-feedback','password-login','reading-completions','reader-consistency','owner-community','owner-provision-audit','smart-reminders','discussion','personal-achievements','owner-eligibility']
let containerId, stage='local metadata preflight', databaseRole='supabase_admin'
function command(args, options={}) {
  const result=docker.run(args,{encoding:'utf8',...options})
  if(result.status!==0)throw Error('Local isolated command failed')
  return result.stdout.trim()
}
function sql(source) {
  if(!containerId)throw Error('No isolated container')
  const result=docker.run(['exec','-i',containerId,'psql','-X','-h','/tmp','-U',databaseRole,'-d','postgres','-v','ON_ERROR_STOP=1'],{input:source,encoding:'utf8'})
  if(result.status!==0) {
    // Emit only categories/assertion labels, never SQL, row values or stderr.
    const code=(result.stderr||'').match(/SQLSTATE ([A-Z0-9]{5})/)?.[1]
    const assertion=(result.stderr||'').match(/ERROR:\s*FAIL: ([A-Za-z0-9 ,:/_.()-]+)/)?.[1]
    const category=(result.stderr||'').match(/ERROR:\s*((?:role |schema |type |function |relation |permission |must be |unrecognized |extension |syntax |could not )[^\r\n]*)/)?.[1]
    if(code)console.error('SQLSTATE '+code)
    if(assertion)console.error('Failed isolated assertion: '+assertion)
    if(category&&!/https?:|postgres(?:ql)?:|password=|eyJ|sb_secret_/i.test(category))console.error('Isolated SQL: '+category.slice(0,220))
    throw Error('Isolated SQL failed')
  }
  return result.stdout
}
function verifyContainer() {
  if(!/^[0-9a-f]{64}$/.test(containerId??''))throw Error('Invalid new container ID')
  // Read only isolation metadata, never container environment/credentials.
  const format='{"Name":{{json .Name}},"Run":{{json (index .Config.Labels "selah.audit.run")}},"NetworkMode":{{json .HostConfig.NetworkMode}},"PortBindings":{{json .HostConfig.PortBindings}},"Mounts":{{json .Mounts}},"Ports":{{json .NetworkSettings.Ports}}}'
  const info=JSON.parse(command(['inspect','--format',format,containerId]))
  if(info.Name!=='/'+name||info.Run!==runId||info.NetworkMode!=='none'
    ||Object.keys(info.PortBindings??{}).length||info.Mounts.some(m=>m.Type!=='tmpfs')
    ||Object.values(info.Ports??{}).some(value=>value!==null))throw Error('Isolation verification failed')
}
try {
  if(readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort().join(',')!==migrations.join(','))throw Error('Unexpected migration sequence')
  const metadata=local.psql(`\n\\pset format unaligned
    \\pset tuples_only on
    begin read only;
    select json_build_object('versions',(select json_agg(version order by version) from supabase_migrations.schema_migrations),
      'operation',(select prosrc from pg_proc where oid='private.reading_operation(uuid,text,uuid,bigint,uuid,bigint)'::regprocedure),
      'identity',(select prosrc from pg_proc where oid='private.reading_identity()'::regprocedure),
      'consistency',(select prosrc from pg_proc where oid='public.get_my_consistency(date)'::regprocedure));
    rollback;`)
  const installed=JSON.parse(metadata.split(/\r?\n/).find(line=>line.startsWith('{'))??'null')
  function body(name,schema='private',file='20261028000200_reading_claims_access.sql') {
    const source=readFileSync('supabase/migrations/'+file,'utf8').replaceAll('\r\n','\n')
    const offset=source.indexOf('function '+schema+'.'+name+'(')
    const value=source.slice(offset).match(/as \$\$([\s\S]*?)\$\$;/)?.[1]
    if(offset<0||!value)throw Error('Missing candidate function')
    return value
  }
  if(![migrations,migrations.slice(0,-1)].some(list=>installed?.versions.join(',')===list.map(f=>f.slice(0,14)).join(','))
    ||installed.operation.replaceAll('\r\n','\n')!==body('reading_operation')
    ||installed.identity.replaceAll('\r\n','\n')!==body('reading_identity')
    ||installed.consistency.replaceAll('\r\n','\n')!==body('get_my_consistency','public','20261028000300_reader_consistency.sql'))throw Error('Installed local SQL differs from candidates')
  console.log('PASS current local migration history and reading/consistency function bodies match candidates (read only)')
  const image=command(['inspect','--format','{{.Image}}','supabase_db_devocionais-app'])
  if(!/^sha256:[0-9a-f]{64}$/.test(image))throw Error('Invalid local image ID')
  const volumes=JSON.parse(command(['image','inspect','--format','{{json .Config.Volumes}}',image]))
  if(Object.keys(volumes??{}).some(p=>p!=='/var/lib/postgresql/data'))throw Error('Unexpected image volumes')
  const uid=command(['exec','supabase_db_devocionais-app','id','-u','postgres'])
  const gid=command(['exec','supabase_db_devocionais-app','id','-g','postgres'])
  if(!/^\d+$/.test(uid)||!/^\d+$/.test(gid))throw Error('Invalid local image user')
  const dump=command(['exec','supabase_db_devocionais-app','pg_dump','--schema-only','--schema=auth','--no-owner','--no-privileges','-h','/var/run/postgresql','-U','postgres','-d','postgres'])
  // pg_dump includes application triggers currently on auth.users. These must
  // come from their original migrations, not from the bootstrap DDL copy.
  const authDdl=dump.replace(/^CREATE TRIGGER [^\n]+ EXECUTE FUNCTION private\.[^\n]+;\r?$/gm,'')
  if(/EXECUTE FUNCTION private\./.test(authDdl)||/^COPY |^INSERT INTO /m.test(authDdl)||!authDdl.includes('CREATE TABLE auth.users'))throw Error('Unexpected Auth schema DDL')
  stage='new isolated PostgreSQL startup'
  containerId=command(['run','--detach','--rm','--pull=never','--name',name,'--label','selah.audit.run='+runId,
    '--network=none','--read-only','--user',uid+':'+gid,
    '--tmpfs',`/var/lib/postgresql/data:rw,uid=${uid},gid=${gid},mode=0700`,
    '--tmpfs','/tmp:rw,mode=1777','--entrypoint','/bin/sh',image,'-c',
    'initdb -D /var/lib/postgresql/data -A trust -U supabase_admin > /dev/null && exec postgres -D /var/lib/postgresql/data -c listen_addresses= -c unix_socket_directories=/tmp -c shared_buffers=16MB -c max_connections=20'])
  verifyContainer()
  let ready=false
  for(let i=0;i<60;i++) {
    if(docker.run(['exec',containerId,'pg_isready','-h','/tmp','-U','supabase_admin'],{encoding:'utf8'}).status===0){ready=true;break}
    await new Promise(resolve=>setTimeout(resolve,250))
  }
  if(!ready)throw Error('New isolated PostgreSQL unavailable')
  stage='Auth schema-only bootstrap'
  sql(`create role postgres login nosuperuser bypassrls createrole createdb;
    create role supabase_auth_admin nologin;
    create role anon nologin; create role authenticated nologin;
    create role service_role nologin bypassrls;
    grant anon,authenticated to postgres;
    create schema extensions; create extension pgcrypto with schema extensions;
    create extension dblink with schema extensions;
    grant execute on function extensions.dblink_connect_u(text,text) to postgres;
    grant usage on schema extensions to postgres;
    alter database postgres owner to postgres;`)
  stage='managed Auth DDL and grants'
  sql(`set role supabase_admin;
    ${authDdl}
    grant usage on schema auth to postgres,anon,authenticated,service_role;
    grant all on all tables in schema auth to postgres;
    grant all on all sequences in schema auth to postgres;
    grant execute on all functions in schema auth to postgres;
    reset role;`)
  stage='migration operator privileges'
  sql('grant set on parameter session_replication_role to postgres;')
  databaseRole='postgres'
  stage='limited operator privilege assertions'
  sql(`do $$begin
    if not exists(select 1 from pg_roles where rolname='postgres' and not rolsuper and rolcreaterole and rolbypassrls)
      or not has_schema_privilege('postgres','auth','USAGE')
      or has_schema_privilege('postgres','auth','USAGE WITH GRANT OPTION') then
      raise exception 'FAIL: limited operator privilege model';
    end if;
  end$$;`)
  console.log('PASS migration operator is not superuser; auth schema usage has no grant option')
  for(const file of migrations) {
    stage='migration '+file.slice(0,14)
    sql(readFileSync('supabase/migrations/'+file,'utf8'))
    console.log('PASS isolated migration '+file.slice(0,14))
    if(file===migrations[0]) {
      sql(`begin;
        insert into auth.users(id,email) values ('91000000-0000-4000-8000-000000000001','isolated-legacy@example.invalid');
        insert into public.profiles(id,name,phone) values ('91000000-0000-4000-8000-000000000001','Perfil legado ficticio','+5511999990000');
        insert into public.devotionals(id,title,bible_reference,bible_text,content,reflection_question,publish_at,status,author_id)
          values ('92000000-0000-4000-8000-000000000001','Texto legado ficticio','Ref ficticia','Texto ficticio','Conteudo ficticio','Pergunta?',now()-interval '1 day','published','91000000-0000-4000-8000-000000000001');
        insert into public.devotional_views(id,devotional_id,user_id,opened_at) values ('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','2020-01-01T12:00:00Z');
        commit;`)
    }
  }
  stage='legacy compatibility'
  const compatibility=sql(`begin read only;
    select (select count(*)=1 from public.profiles where id='91000000-0000-4000-8000-000000000001' and name='Perfil legado ficticio' and phone='+5511999990000' and not whatsapp_required)
      and not exists(select 1 from public.account_usernames where user_id='91000000-0000-4000-8000-000000000001')
      and exists(select 1 from public.devotional_views where id='93000000-0000-4000-8000-000000000001' and devotional_id='92000000-0000-4000-8000-000000000001' and opened_at='2020-01-01T12:00:00Z')
      and exists(select 1 from public.devotionals where id='92000000-0000-4000-8000-000000000001' and reading_revision=1)
      and not exists(select 1 from public.reading_progress)
      and not exists(select 1 from public.devotional_completions) as legacy_preserved;
    rollback;`)
  if(!/^\s*t\s*$/m.test(compatibility))throw Error('Legacy compatibility failed')
  console.log('PASS isolated legacy profile, phone, opening, content identity and empty new ledgers preserved')
  let checks=0
  for(const suite of suites) {
    stage='isolated SQL '+suite
    const source=readFileSync('supabase/tests/'+suite+'.sql','utf8')
    const output=sql(source)
    if(!output.includes('ROLLBACK'))throw Error('Missing suite rollback')
    const dynamic=suite==='reading-completions'?'reading':suite==='reader-consistency'?'consistency':suite==='owner-community'?'owner':suite==='owner-provision-audit'?'owner audit':suite==='smart-reminders'?'reminder':suite==='discussion'?'discussion':suite==='personal-achievements'?'reward':suite==='owner-eligibility'?'eligibility':null
    const count=dynamic ? Number(output.match(new RegExp('(\\d+) '+dynamic+' SQL checks passed'))?.[1])
      : (source.match(/select pg_temp\.(?:assert_true|denied|affected|rejected)\(/g)||[]).length
    if(!Number.isInteger(count)||count<1)throw Error('Invalid isolated check count')
    checks+=count;console.log(`PASS isolated ${suite}: ${count} SQL checks with rollback`)
  }
  console.log(`${migrations.length} migrations and ${checks} SQL checks passed in NEW isolated local PostgreSQL. Auth DDL only; no copied user rows or secrets.`)
  stage='isolated reminder overlapping transactions'
  const overlap=sql(readFileSync('supabase/tests/reminder-concurrency.sql','utf8'))
  if(!overlap.includes('2 overlapping transaction checks passed'))throw Error('Missing concurrency checks')
  console.log('PASS 2 overlapping transaction checks: locked device skipped and one committed daily reservation')
  stage='isolated discussion concurrent writes'
  const discussionOverlap=sql(readFileSync('supabase/tests/discussion-concurrency.sql','utf8'))
  if(!discussionOverlap.includes('10 discussion concurrency checks passed'))throw Error('Missing discussion concurrency checks')
  console.log('PASS 10 discussion concurrency checks: reactions, principal comment, edit versus stale approval, duplicate reports and quota')
  stage='isolated personal challenge concurrent writes'
  const rewardOverlap=sql(readFileSync('supabase/tests/personal-achievements-concurrency.sql','utf8'))
  if(!rewardOverlap.includes('6 reward concurrency checks passed'))throw Error('Missing reward concurrency checks')
  console.log('PASS 6 reward concurrency checks: overlapping enrollments, cancellations, no restart and no completion writes')
} catch {
  console.error(`Isolated installation stopped at ${stage}. Remaining checks NOT validated; existing database and volumes unchanged.`)
  process.exitCode=1
} finally {
  if(containerId) {
    try {
      verifyContainer()
      command(['stop','--time','5',containerId])
      console.log('Only this run\'s isolated container stopped; temporary data discarded. No existing volume touched.')
    } catch { console.error('Unable to verify/stop this run\'s temporary container safely; inspect its audit label.');process.exitCode=1 }
  }
}
