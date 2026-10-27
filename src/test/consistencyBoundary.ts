import type { Consistency } from '../consistency/repository'
import { monthDays } from '../consistency/calendar'

// Synthetic server response. It does not calculate or assert the streak formula.
export function consistencyFixture(overrides: Partial<Consistency> = {}): Consistency {
  const month = overrides.month ?? '2026-10-01'
  return {
    server_now: '2026-10-28T15:00:00Z', server_today: '2026-10-28', time_zone: 'America/Sao_Paulo',
    month, current_month: '2026-10-01', first_month: '2026-10-01',
    current_streak: 0, best_streak: 0, total_days: 0, total_devotionals: 0,
    today_completed: false, last_completed_day: null, status: 'empty',
    ...overrides,
    days: overrides.days ?? monthDays(month).map(date => ({ date, completions: overrides.today_completed && date === (overrides.server_today ?? '2026-10-28') ? 1 : 0 })),
  }
}
