import { prepareLocalScript } from './local-environment.mjs'
const local=prepareLocalScript(),client=local.client()
const id='10000000-0000-4000-8000-000000000001'
let checks=0
for(const [name,args] of [
  ['get_devotional_discussion',{p_devotional:id}],['get_my_discussion_access',{}],['get_owner_discussion',{}],
  ['set_my_devotional_reaction',{p_devotional:id,p_value:'like'}],
  ['save_my_devotional_comment',{p_devotional:id,p_body:'Fictional test',p_version:0}],
  ['remove_my_devotional_comment',{p_devotional:id,p_version:0}],
  ['report_devotional_comment',{p_comment:id,p_reason:'spam'}],
  ['moderate_devotional_comment',{p_comment:id,p_version:1,p_action:'approve',p_reason:'reviewed'}],
]) {
  const result=await client.rpc(name,args)
  if(result.error?.code!=='42501')throw Error('Expected authorization denial, not a missing RPC')
  checks++
}
for(const table of ['discussion_comments','discussion_reactions','discussion_reports','discussion_audit','discussion_limits']) {
  const result=await client.schema('private').from(table).select('*').limit(1)
  if(!result.error)throw Error('Private discussion table accessible')
  checks++
}
console.log(`${checks} local negative discussion HTTP checks passed; no rows, users or sessions changed.`)
