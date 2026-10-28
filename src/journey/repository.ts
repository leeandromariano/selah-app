import type { SupabaseClient } from '@supabase/supabase-js'
import { civilDate } from '../consistency/calendar'

export const badgeNames = ['Primeiros passos', 'Uma semana', 'Perseverança', 'Constância', 'Dedicação', 'Jornada de fé']
export const milestones = [3, 7, 14, 30, 60, 100]
export type Challenge = { week_start: string; target: number; days: number; status: 'active' | 'completed' | 'ended' | 'cancelled' }
export type Rewards = { server_today: string; time_zone: string; week_start: string; badges: { days: number; unlocked: boolean }[]; challenges: Challenge[] }
export function parseRewards(value: unknown): Rewards {
  const v = value as Rewards
  if (!v || !civilDate(v.server_today) || !civilDate(v.week_start) || v.week_start > v.server_today
    || v.time_zone !== 'America/Sao_Paulo' || !Array.isArray(v.badges) || v.badges.length !== 6
    || v.badges.some((b, i) => b.days !== milestones[i] || typeof b.unlocked !== 'boolean')
    || !Array.isArray(v.challenges) || v.challenges.length > 52
    || v.challenges.some(c => !civilDate(c.week_start) || c.week_start > v.week_start
      || ![3, 5, 7].includes(c.target) || !Number.isInteger(c.days) || c.days < 0 || c.days > 7
      || !['active', 'completed', 'ended', 'cancelled'].includes(c.status))) throw Error('Invalid journey rewards')
  return v
}
export function createJourneyRepository(client: Pick<SupabaseClient, 'rpc'>) {
  async function request(name: string, args = {}) {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(12000))
    if (error) throw error
    return parseRewards(data)
  }
  return {
    snapshot: () => request('get_my_journey_rewards'),
    start: (target: number) => {
      if (![3, 5, 7].includes(target)) return Promise.reject(Error('Invalid target'))
      return request('start_my_personal_challenge', { p_target: target })
    },
    cancel: () => request('cancel_my_personal_challenge'),
  }
}
