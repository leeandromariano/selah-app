import { prepareLocalScript } from './local-environment.mjs'
const local = prepareLocalScript()
const client = local.client()
let checks = 0
for (const [name, args] of [
  ['get_my_reminders', {}],
  ['save_my_reminders', { p_device: '10000000-0000-4000-8000-000000000001', p_secret: 'A'.repeat(43), p_enabled: false, p_time: '08:00', p_timezone: 'UTC', p_permission: 'denied' }],
  ['revoke_my_push_device', { p_device: '10000000-0000-4000-8000-000000000001', p_secret: 'A'.repeat(43) }],
  ['confirm_my_push_device', { p_device: '10000000-0000-4000-8000-000000000001', p_secret: 'A'.repeat(43), p_proof: '20000000-0000-4000-8000-000000000001' }],
]) {
  const result = await client.rpc(name, args)
  if (!['42501', 'PGRST301', 'PGRST303'].includes(result.error?.code)) throw Error('Expected authorization rejection, not a missing RPC')
  checks++
}
console.log(`${checks} local anonymous HTTP authorization rejections passed; no records changed.`)
