import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createReadingPlansRepository } from './plansRepository'
import type { PlanEnrollment } from './plansRepository'
import type { PlanId } from './plans'

const defaultRepository = createReadingPlansRepository(supabase)
export type PlansRepository = typeof defaultRepository

// Dia de hoje em Brasília (AAAA-MM-DD), o mesmo fuso usado pelo servidor ao registrar a adesão.
export const todayInBrazil = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

export function useReadingPlans(repo: PlansRepository = defaultRepository) {
  const [enrollments, setEnrollments] = useState<PlanEnrollment[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState<PlanId | null>(null)

  useEffect(() => {
    let active = true
    repo.mine().then(list => { if (active) setEnrollments(list) }).catch((error: Error) => { if (active) setLoadError(error.message) })
    return () => { active = false }
  }, [repo])

  const run = useCallback(async (plan: PlanId, action: () => Promise<PlanEnrollment | void>) => {
    setBusy(plan); setActionError('')
    try {
      const saved = await action()
      setEnrollments(list => {
        const rest = (list ?? []).filter(item => item.plan !== plan)
        return saved ? [...rest, saved] : rest
      })
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível salvar agora.') }
    finally { setBusy(null) }
  }, [])

  return {
    enrollments, loadError, actionError, busy,
    join: (plan: PlanId) => run(plan, () => repo.join(plan)),
    setDay: (plan: PlanId, day: number, done: boolean) => run(plan, () => repo.setDay(plan, day, done)),
    leave: (plan: PlanId) => run(plan, () => repo.leave(plan)),
  }
}
