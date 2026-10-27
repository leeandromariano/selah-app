import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConsistencyStatus } from './repository'
import { civilDate } from './calendar.ts'
export type CommunityReader = { username: string | null; current_streak: number; best_streak: number; total_days: number; status: ConsistencyStatus }
export type Community = { server_today: string; time_zone: string; total_readers: number; completed_today: number; matched_readers: number; page: number; size: number; readers: CommunityReader[] }
export function createCommunityRepository(client: Pick<SupabaseClient, 'rpc'>) {
  return { async list(search = '', page = 0, size = 25): Promise<Community> {
    const normalized = search.trim().replace(/^@/, '').toLowerCase()
    if (!/^[a-z0-9_]{0,24}$/.test(normalized) || !Number.isInteger(page) || page < 0 || page > 1000000 || !Number.isInteger(size) || size < 1 || size > 100) throw Error('Consulta inválida. Use parte de um username válido.')
    const { data, error } = await client.rpc('get_owner_community', { p_search: normalized, p_page: page, p_size: size }).abortSignal(AbortSignal.timeout(12000))
    if (error) throw error
    const v = data as Community
    if (!v || !civilDate(v.server_today) || v.time_zone !== 'America/Sao_Paulo' || v.page !== page || v.size !== size
      || ![v.total_readers, v.completed_today, v.matched_readers].every(n => Number.isSafeInteger(n) && n >= 0)
      || v.completed_today > v.total_readers || v.matched_readers > v.total_readers || !Array.isArray(v.readers) || v.readers.length > size
      || v.readers.some(r => (r.username !== null && !/^[a-z][a-z0-9_]{2,23}$/.test(r.username))
        || ![r.current_streak, r.best_streak, r.total_days].every(n => Number.isSafeInteger(n) && n >= 0)
        || r.current_streak > r.best_streak || r.best_streak > r.total_days
        || !['empty','completed_today','pending_today','interrupted'].includes(r.status))) throw Error('Invalid community response')
    // Explicit projection: never retain unexpected private fields in UI state.
    return { server_today: v.server_today, time_zone: v.time_zone, total_readers: v.total_readers, completed_today: v.completed_today, matched_readers: v.matched_readers, page, size,
      readers: v.readers.map(r => ({ username: r.username, current_streak: r.current_streak, best_streak: r.best_streak, total_days: r.total_days, status: r.status })) }
  } }
}
