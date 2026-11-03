import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { localDocker } from './local-docker.mjs'

if (process.argv.length !== 3 || process.argv[2] !== '--run-disposable') throw Error('Use --run-disposable explicitly')
const docker = localDocker()
const runId = randomUUID()
const name = 'selah-editorial-' + runId
let id = ''
function command(args, options = {}) {
  const r = docker.run(args, { encoding: 'utf8', timeout: 20000, ...options })
  if (r.status !== 0) throw Error('Docker command failed: ' + (r.stderr || '').slice(-500))
  return (r.stdout || '').trim()
}
function verified() {
  if (!/^[a-f0-9]{64}$/.test(id)) throw Error('Invalid container ID')
  const value = JSON.parse(command(['inspect', '--format', '{{json .}}', id]))
  if (value.Name !== '/' + name || value.Config.Labels?.['selah.editorial.run'] !== runId || value.HostConfig.NetworkMode !== 'none' || value.Mounts.length || Object.keys(value.HostConfig.Tmpfs || {}).join() !== '/tmp' || value.Config.Image !== 'public.ecr.aws/supabase/postgres:17.11.0.006') throw Error('Isolation verification failed')
}
function sql(source, label, options = {}) {
  verified()
  const r = docker.run(['exec','-i',id,'psql','-X','-h','/tmp','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1', ...options.args || []], { input: source, encoding: 'utf8', timeout: 20000 })
  if (r.status !== 0) throw Error(label + ': ' + (r.stderr || '').slice(-2500))
  if (label === 'editorial tests') {
    const lines = (r.stderr || '').split(/\r?\n/).filter(x => x.includes('NOTICE:  PASS:'))
    console.log(label + ': ' + lines.length + ' verificacoes')
    for (const line of lines) console.log(line)
  } else console.log(label + ': PASS')
}
const bootstrap = `
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth; create schema extensions; create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,raw_user_meta_data jsonb default '{}'::jsonb,created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
grant usage on schema auth to public; grant execute on all functions in schema auth to public;`
const seed = `
set session_replication_role=replica;
insert into auth.users(id,email_confirmed_at) values
('11000000-0000-4000-8000-000000000001',now()),
('11000000-0000-4000-8000-000000000002',now()),
('11000000-0000-4000-8000-000000000003',now());
set session_replication_role=origin;
insert into private.app_owner(user_id) values ('11000000-0000-4000-8000-000000000001');
insert into public.devotionals(id,title,bible_reference,bible_text,content,reflection_question,status,publish_at,author_id)
values ('22000000-0000-4000-8000-000000000001','A','R','T','C','Q','published',now(),'11000000-0000-4000-8000-000000000001'),
('22000000-0000-4000-8000-000000000002','B','R','T','C','Q','published',now(),'11000000-0000-4000-8000-000000000001');
insert into private.editorial_series(id,title,slug,available) values('44000000-0000-4000-8000-000000000001','S','s',true);
insert into private.editorial_episodes values('44000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001',1),
('44000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000002',2);`
const owner = "set local role authenticated; select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);"
const actions = [
  ["create_theme", "select public.owner_editorial_change('create_theme','{\"name\":\"Temporary\",\"slug\":\"temporary\"}');", '11000000-0000-4000-8000-000000000002'],
  ["reorder_series", "select public.owner_editorial_change('reorder_series','{\"series_id\":\"44000000-0000-4000-8000-000000000001\",\"devotional_ids\":[\"22000000-0000-4000-8000-000000000002\",\"22000000-0000-4000-8000-000000000001\"]}');", '11000000-0000-4000-8000-000000000003'],
]
async function contention(label, action, reader) {
  verified()
  const args = ['--host', docker.env.DOCKER_HOST,'exec','-i',id,'psql','-X','-qAt','-h','/tmp','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
  const a = spawn('docker', args, { env: docker.env, stdio: ['pipe','pipe','pipe'] })
  let stdout = '', stderr = ''
  a.stderr.on('data', x => { stderr += x })
  const done = new Promise(resolve => a.on('exit', resolve))
  const marker = new Promise((resolve,reject) => {
    const timer = setTimeout(() => reject(Error('editorial lock marker timeout')), 10000)
    a.stdout.on('data', x => { stdout += x; if (stdout.includes('LOCK_HELD')) { clearTimeout(timer); resolve() } })
    a.on('exit', code => { if (code) { clearTimeout(timer); reject(Error('editorial transaction failed: ' + stderr.slice(-500))) } })
  })
  a.stdin.end('begin;' + owner + action + "select 'LOCK_HELD'; select pg_sleep(2); rollback;")
  await marker
  verified()
  const request = "begin; set local lock_timeout='1500ms'; set local role authenticated; select set_config('request.jwt.claim.sub','" + reader + "',true); insert into public.account_deletion_requests(user_id) values ('" + reader + "'); commit;"
  const blocked = docker.run(['exec','-i',id,'psql','-X','-h','/tmp','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'], { input: request, encoding: 'utf8', timeout: 10000 })
  if (blocked.status !== 0) throw Error(label + ': unrelated identity must not block: ' + (blocked.stderr || '').slice(-500))
  if (a.exitCode !== null) throw Error(label + ': editorial transaction did not overlap request')
  console.log(label + ': pedido de outra conta concluiu durante a operacao editorial')
  if (await done !== 0) throw Error(label + ': editorial rollback failed: ' + stderr.slice(-500))
}
try {
  const migrations = readdirSync('supabase/migrations').filter(n => n.endsWith('.sql')).sort()
  if (migrations.length !== 16 || migrations.some(n => /editorial_structure/i.test(n))) throw Error('Unexpected official migration set')
  id = command(['run','--detach','--rm','--pull=never','--network','none','--name',name,'--label','selah.editorial.run='+runId,'--tmpfs','/tmp:rw,mode=1777','--user','postgres','--entrypoint','sh','public.ecr.aws/supabase/postgres:17.11.0.006','-c','initdb -D /tmp/editorial-db -A trust -U postgres >/dev/null && exec postgres -D /tmp/editorial-db -c listen_addresses= -c unix_socket_directories=/tmp'])
  verified()
  let ready = false
  for (let i=0;i<50;i++) {
    if (docker.run(['exec',id,'pg_isready','-h','/tmp','-U','postgres'],{encoding:'utf8'}).status === 0) { ready = true; break }
    await new Promise(resolve => setTimeout(resolve,200))
  }
  if (!ready) throw Error('Disposable database failed to start')
  sql(bootstrap,'synthetic auth bootstrap')
  for (const file of migrations) sql(readFileSync('supabase/migrations/'+file,'utf8'),file)
  sql(readFileSync('docs/proposals/sql/NAO_APLICAR_20261028001000_editorial_structure.sql','utf8'),'explicit candidate')
  sql(readFileSync('supabase/tests/editorial_structure.sql','utf8'),'editorial tests')
  sql(seed,'concurrency fixtures')
  for (const [label, action, reader] of actions) await contention(label, action, reader)
  sql(`do $$ begin
  if exists(select 1 from private.editorial_themes where slug='temporary')
    or (select count(*) from public.account_deletion_requests where user_id in ('11000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000003'))<>2
    or (select array_agg(position order by devotional_id) from private.editorial_episodes where series_id='44000000-0000-4000-8000-000000000001')<>array[1,2]
  then raise exception 'rollback or final state invalid'; end if; end $$;`,'final state after rollback')
} finally {
  if (id) {
    try { verified(); command(['stop','--time','5',id]); console.log('Cleanup: only the verified disposable container stopped') }
    catch (error) { console.error('Cleanup failed for run label '+runId+': '+error.message); process.exitCode = 1 }
  }
}
