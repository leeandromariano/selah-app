// No signup/login, fixture, permission change or token inspection. Anonymous and
// deliberately invalid-token requests only; existing owner session is untouched.
import { openOwnerEnvironment } from './local-owner-tools.mjs'
try {
  const local=openOwnerEnvironment()
  if(process.argv.slice(2).join()==='--check-local')console.log('Local community read-only HTTP preflight passed. No changes.')
  else {
    if(process.argv.length!==2)throw Error('Unexpected arguments')
    let passed=0
    const check=(ok,label)=>{if(!ok)throw Error('HTTP rejection failed');passed++;console.log('PASS '+label)}
    const client=local.client()
    check(Boolean((await client.rpc('get_owner_community')).error),'anonymous community RPC denied')
    check(Boolean((await client.rpc('get_my_consistency')).error),'anonymous personal metrics denied')
    for(const [schema,table] of [['private','app_owner'],['private','owner_provision_audit'],['public','devotional_completions'],['public','reading_progress']]) {
      const result=await client.schema(schema).from(table).select('*').limit(1)
      check(Boolean(result.error),'anonymous '+table+' read denied')
    }
    const result=await local.fetch(local.api+'/rest/v1/rpc/get_owner_community',{
      method:'POST',headers:{apikey:local.publicKey,Authorization:'Bearer fiction.invalid.signature','Content-Type':'application/json'},body:'{}',
    })
    check(result.status===401,'invalid bearer cannot become OWNER')
    check(Boolean((await client.rpc('get_owner_community',{p_search:'',p_page:0,p_size:25,p_role:'OWNER'})).error),'caller-supplied OWNER parameter cannot authorize ranking')
    console.log(`${passed} local read-only community HTTP checks passed. No records, permissions or sessions changed.`)
  }
}catch {console.error('Local community read-only HTTP refused or failed. No identifiers or credentials printed.');process.exitCode=1}
