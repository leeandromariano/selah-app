import type { SupabaseClient } from '@supabase/supabase-js'
import { isPlanId, plans } from './plans'
import type { PlanId } from './plans'

export type PlanEnrollment = { plan: PlanId; started_on: string; completed_days: number[] }
const day = /^\d{4}-\d{2}-\d{2}$/

function parse(value: unknown): PlanEnrollment | null {
  const v = value as Partial<PlanEnrollment> | null
  if (!v || !isPlanId(v.plan) || typeof v.started_on !== 'string' || !day.test(v.started_on) || !Array.isArray(v.completed_days)) return null
  const max = plans[v.plan].days
  return { plan: v.plan, started_on: v.started_on, completed_days: v.completed_days.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= max) }
}
const must = (value: unknown, message: string): PlanEnrollment => { const parsed = parse(value); if (!parsed) throw Error(message); return parsed }

export function createReadingPlansRepository(client: Pick<SupabaseClient, 'rpc'>) {
  return {
    async mine(): Promise<PlanEnrollment[]> {
      const { data, error } = await client.rpc('reading_plans_mine')
      if (error || !Array.isArray(data)) throw Error('Não foi possível carregar seus planos de leitura.')
      return data.flatMap(item => { const parsed = parse(item); return parsed ? [parsed] : [] })
    },
    async join(plan: PlanId): Promise<PlanEnrollment> {
      const { data, error } = await client.rpc('reading_plan_join', { p_plan: plan })
      if (error) throw Error('Não foi possível entrar no plano agora.')
      return must(data, 'Não foi possível entrar no plano agora.')
    },
    async setDay(plan: PlanId, dayNumber: number, done: boolean): Promise<PlanEnrollment> {
      const { data, error } = await client.rpc('reading_plan_set_day', { p_plan: plan, p_day: dayNumber, p_done: done })
      if (error) throw Error('Não foi possível salvar este dia agora.')
      return must(data, 'Não foi possível salvar este dia agora.')
    },
    async leave(plan: PlanId): Promise<void> {
      const { error } = await client.rpc('reading_plan_leave', { p_plan: plan })
      if (error) throw Error('Não foi possível sair do plano agora.')
    },
  }
}
