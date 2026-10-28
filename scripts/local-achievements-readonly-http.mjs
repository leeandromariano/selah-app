import { prepareLocalScript } from './local-environment.mjs'
const local = prepareLocalScript(), client = local.client()
let checks = 0
for (const [name, args] of [
  ['get_my_journey_rewards', {}],
  ['start_my_personal_challenge', { p_target: 3 }],
  ['cancel_my_personal_challenge', {}],
]) {
  const result = await client.rpc(name, args)
  if (result.error?.code !== '42501') throw Error('Expected authorization denial, not a missing RPC')
  checks++
}
const result = await client.schema('private').from('personal_challenges').select('*').limit(1)
if (!result.error) throw Error('Private challenges table accessible')
checks++
console.log(`${checks} local negative achievements HTTP checks passed; no rows, users or sessions changed.`)
