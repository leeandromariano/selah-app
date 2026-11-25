import type { SupabaseClient } from '@supabase/supabase-js'
import { civilDate } from '../consistency/calendar.ts'
import { calendarDay, isPlanId, plans } from '../reading/plans'
import type { PlanId } from '../reading/plans'

export type OwnerPlanItem = { username: string | null; plan: PlanId; started_on: string; done_days: number; total_days: number; percent: number; updated_on: string }
export type OwnerPlans = {
  server_today: string; readers: number; enrollments: number; finished: number
  plans: { plan: PlanId; enrolled: number; average_percent: number }[]
  matched: number; page: number; size: number; items: OwnerPlanItem[]
}

const count = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
const pct = (n: unknown) => count(n) && n <= 100

// Situação do leitor em relação ao calendário do plano; o dia de hoje ainda não conta como atraso.
export function planStatus(item: OwnerPlanItem, today: string): string {
  if (item.done_days >= item.total_days) return 'Concluído'
  const expected = Math.max(1, Math.min(item.total_days, calendarDay(item.started_on, today)))
  const days = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`
  if (item.done_days > expected) return `${days(item.done_days - expected)} à frente`
  const behind = expected - 1 - item.done_days
  return behind > 0 ? `${days(behind)} a recuperar` : 'Em dia'
}

export function createOwnerReadingPlansRepository(client: Pick<SupabaseClient, 'rpc'>) {
  return {
    async list(search = '', plan: PlanId | '' = '', page = 0, size = 25): Promise<OwnerPlans> {
      const normalized = search.trim().replace(/^@/, '').toLowerCase()
      if (!/^[a-z0-9_]{0,24}$/.test(normalized) || !Number.isInteger(page) || page < 0 || page > 1000000 || !Number.isInteger(size) || size < 1 || size > 100) throw Error('Consulta inválida. Use parte de um username válido.')
      const { data, error } = await client.rpc('get_owner_reading_plans', { p_search: normalized, p_plan: plan, p_page: page, p_size: size }).abortSignal(AbortSignal.timeout(12000))
      if (error) throw error
      const v = data as OwnerPlans
      if (!v || !civilDate(v.server_today) || v.page !== page || v.size !== size || ![v.readers, v.enrollments, v.finished, v.matched].every(count)
        || !Array.isArray(v.plans) || v.plans.some(p => !isPlanId(p?.plan) || !count(p.enrolled) || !pct(p.average_percent))
        || !Array.isArray(v.items) || v.items.length > size
        || v.items.some(i => !i || (i.username !== null && !/^[a-z][a-z0-9_]{2,23}$/.test(i.username)) || !isPlanId(i.plan) || !civilDate(i.started_on) || !civilDate(i.updated_on)
          || i.total_days !== plans[i.plan].days || !count(i.done_days) || i.done_days > i.total_days || !pct(i.percent))) throw Error('Invalid reading plans response')
      // Projeção explícita: nenhum campo inesperado fica no estado da tela.
      return {
        server_today: v.server_today, readers: v.readers, enrollments: v.enrollments, finished: v.finished, matched: v.matched, page, size,
        plans: v.plans.map(p => ({ plan: p.plan, enrolled: p.enrolled, average_percent: p.average_percent })),
        items: v.items.map(i => ({ username: i.username, plan: i.plan, started_on: i.started_on, done_days: i.done_days, total_days: i.total_days, percent: i.percent, updated_on: i.updated_on })),
      }
    },
  }
}
