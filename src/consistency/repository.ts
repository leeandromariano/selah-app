import type { SupabaseClient } from '@supabase/supabase-js'
import { localDay, readingTimeZone } from '../devotionals/repository.ts'
import { civilDate, monthDate, monthDays } from './calendar.ts'

export type ConsistencyDay = { date: string; completions: number }
export type ConsistencyStatus = 'empty' | 'completed_today' | 'pending_today' | 'interrupted'
export type Consistency = {
  server_now: string; server_today: string; time_zone: 'America/Sao_Paulo';
  month: string; current_month: string; first_month: string;
  current_streak: number; best_streak: number; today_completed: boolean;
  total_days: number; total_devotionals: number; last_completed_day: string | null;
  status: ConsistencyStatus; days: ConsistencyDay[];
}
function parse(data: unknown): Consistency {
  const v = data as Consistency | null
  const counts = v && [v.current_streak, v.best_streak, v.total_days, v.total_devotionals]
  if (!v || typeof v.server_now !== 'string' || !Number.isFinite(Date.parse(v.server_now)) || !civilDate(v.server_today)
    || localDay(v.server_now) !== v.server_today || v.time_zone !== readingTimeZone
    || !monthDate(v.month) || !monthDate(v.current_month) || !monthDate(v.first_month)
    || v.current_month !== v.server_today.slice(0, 8) + '01' || v.first_month > v.current_month
    || !counts!.every(n => Number.isSafeInteger(n) && n >= 0)
    || !(v.current_streak <= v.best_streak && v.best_streak <= v.total_days && v.total_days <= v.total_devotionals)
    || !['empty', 'completed_today', 'pending_today', 'interrupted'].includes(v.status)
    || typeof v.today_completed !== 'boolean' || v.today_completed !== (v.status === 'completed_today')
    || (v.last_completed_day !== null && (!civilDate(v.last_completed_day) || v.last_completed_day > v.server_today))
    || (v.status === 'empty' && (v.total_days !== 0 || v.total_devotionals !== 0 || v.last_completed_day !== null))
    || (v.status !== 'empty' && (v.total_days === 0 || v.last_completed_day === null))
    || (['empty', 'interrupted'].includes(v.status) ? v.current_streak !== 0 : v.current_streak < 1)
    || !Array.isArray(v.days)) throw new Error('Invalid consistency response')
  const expected = monthDays(v.month)
  if (v.days.length !== expected.length || v.days.some((d, index) => d.date !== expected[index]
    || !Number.isSafeInteger(d.completions) || d.completions < 0 || (d.date > v.server_today && d.completions > 0))) throw new Error('Invalid consistency calendar')
  return v
}
export function consistencyMessage(error: unknown) {
  return ['42501', 'PGRST301', 'PGRST303'].includes((error as { code?: string })?.code ?? '')
    ? 'Sua sessão não autoriza esta consulta. Entre novamente para continuar.'
    : 'Não foi possível carregar sua consistência. Verifique sua conexão e tente novamente.'
}
export function createConsistencyRepository(client: Pick<SupabaseClient, 'rpc'>) {
  return {
    async snapshot(month: string | null = null): Promise<Consistency> {
      if (month !== null && !monthDate(month)) throw new Error('Invalid calendar selection')
      // No user ID, "today", duration or counter supplied by the browser.
      const { data, error } = await client.rpc('get_my_consistency', { p_month: month }).abortSignal(AbortSignal.timeout(12000))
      if (error) throw error
      const result = parse(data)
      if (month !== null && result.month !== month) throw new Error('Unexpected calendar selection')
      return result
    },
  }
}
