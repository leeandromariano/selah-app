import { readFileSync } from 'node:fs'
import { prepareLocalScript } from './local-environment.mjs'
const local=prepareLocalScript()
try {
  const suites=process.argv.includes('--regression') ? ['authorization','privacy-essential','usernames','whatsapp-feedback','password-login','reading-completions','reader-consistency'] : ['reader-consistency']
  for(const suite of suites) {
    const source=readFileSync('supabase/tests/'+suite+'.sql','utf8')
    const result=local.docker.run(['exec','-i','supabase_db_devocionais-app','psql','-X','-h','/var/run/postgresql','-p','5432','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:source,encoding:'utf8'})
    if(result.status!==0) {
      const error=(result.stderr||'').match(/ERROR:[^\r\n]*/)?.[0]
      if(error)console.error(error.slice(0,220))
      throw Error('Local SQL failed')
    }
    if(!result.stdout.includes('ROLLBACK'))throw Error('Missing rollback')
    const summary=result.stdout.match(/\d+ (?:reading|consistency) SQL checks passed; ROLLBACK complete\./)?.[0]
    if(summary)console.log(summary)
    else console.log(`${(source.match(/select pg_temp\.(?:assert_true|denied|affected|rejected)\(/g)||[]).length} ${suite} SQL checks passed; ROLLBACK complete.`)
  }
} catch {
  console.error('Local consistency SQL failed. Remaining checks NOT validated; transaction closed/rolled back.')
  process.exitCode=1
}
