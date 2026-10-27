import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002'
const mutation=['--confirm',a,'--audit-ref','LOCAL-fictional-test-reference']
describe('entrypoints de OWNER não chegam a mutações em ambiente inseguro',()=>{
  const scripts=[
    {name:'provision-local-owner',modes:[['--check-local'],['inspect',a],['grant',a,...mutation],['revoke',a,...mutation],['transfer',a,b,...mutation,'--confirm-target',b]]},
    ...['apply-local-owner-audit-migration','run-local-owner-audit-sql','local-owner-provision-smoke','audit-local-community','local-community-readonly-http'].map(name=>({name,modes:[['--check-local'],[]]})),
  ]
  for(const script of scripts)it(script.name+' recusa destinos remotos, proxies e credenciais',()=>{
    for(const unsafe of [{DOCKER_HOST:'ssh://fiction.invalid'},{DOCKER_CONTEXT:'--host=tcp://fiction.invalid'},{SUPABASE_URL:'https://fiction.invalid'},{HTTPS_PROXY:'http://fiction.invalid'},{SUPABASE_SERVICE_ROLE_KEY:'fiction-hosted-key'},{VITE_PROD_SUPABASE_URL:'https://fiction.invalid'}]) {
      const environment={...process.env}
      for(const key of ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy','DOCKER_HOST','DOCKER_CONTEXT'])delete environment[key]
      for(const mode of script.modes) {
        const result=spawnSync(process.execPath,['scripts/'+script.name+'.mjs',...mode],{env:{...environment,...unsafe},encoding:'utf8',timeout:10000})
        expect(result.status).toBe(1)
        expect(result.stdout).toBe('')
        expect(result.stderr).toMatch(/refused|Credential or runtime override refused|Proxy configuration|Only local Docker sockets|Invalid Docker context|Non-local/i)
        expect(result.stderr).not.toContain(a)
        expect(result.stderr).not.toContain('fiction-hosted-key')
      }
    }
  },20000)
})
