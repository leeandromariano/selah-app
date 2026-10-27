// Test preparation only, on accounts newly created by the guarded entrypoints.
// Dates here model past habits; normal clients never receive a backdating API.
import { uuid } from './reading-local-fixtures.mjs'
export function seedConsistency(local,userId,{offsets=[],dates=[]}={}) {
  uuid(userId)
  if(offsets.some(n=>!Number.isInteger(n)||Math.abs(n)>40000)||dates.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d)))throw Error('Invalid synthetic calendar fixture')
  const days=[...offsets.map(n=>`(base.day+(${n}))`),...dates.map(d=>`(date '${d}')`)]
  if(!days.length)return
  local.psql(`begin;
    with base as (select (clock_timestamp() at time zone 'America/Sao_Paulo')::date as day)
    insert into public.devotional_completions(user_id,source_devotional_id,revision,completed_at,completed_day)
    select '${userId}',gen_random_uuid(),1,(d.day::timestamp+interval '12 hours') at time zone 'America/Sao_Paulo',d.day
    from base cross join lateral (values ${days.join(',')}) d(day);
    commit;`)
}
