import { readFileSync } from 'node:fs'
import { prepareLocalScript } from './local-environment.mjs'
const local = prepareLocalScript()
try {
 const suites=process.argv.includes('--regression') ? ['authorization','privacy-essential','usernames','whatsapp-feedback','password-login','reading-completions'] : ['reading-completions']
 for (const suite of suites) {
  const source=readFileSync('supabase/tests/'+suite+'.sql','utf8')
  const result = local.docker.run(['exec','-i','supabase_db_devocionais-app','psql','-X','-h','/var/run/postgresql','-p','5432','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'], { input: source, encoding: 'utf8' })
  if (result.status !== 0) {
    const label = ((result.stderr || '') + (result.stdout || '')).match(/ERROR:[^\r\n]*/)?.[0]
    if (label) console.error(label.slice(0, 220))
    const context = (result.stderr || '').match(/CONTEXT:[^\r\n]*/)?.[0]
    if (context) console.error(context.slice(0, 220))
    throw new Error('SQL failure')
  }
  const output = result.stdout
  if(!output.includes('ROLLBACK'))throw Error('Missing rollback confirmation')
  if(suite==='reading-completions') {
    const summary = output.match(/\d+ reading SQL checks passed; ROLLBACK complete\./)
    if (!summary) throw new Error('Missing assertion count')
    console.log(summary[0])
  } else {
    const count=(source.match(/select pg_temp\.(?:assert_true|denied|affected|rejected)\(/g)||[]).length
    console.log(`${count} ${suite} SQL checks passed; ROLLBACK complete.`)
  }
 }
} catch {
  console.error('Local reading SQL suite failed; remaining checks NOT validated. Transaction connection closed/rolled back; no credentials printed.')
  process.exitCode = 1
}
