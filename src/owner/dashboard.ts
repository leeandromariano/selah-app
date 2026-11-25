import type { SupabaseClient } from '@supabase/supabase-js'

export type Period = 1 | 7 | 30 | 90
export type Series = { day: string; n: number }[]
export type GameId = 'quiz' | 'claims' | 'who' | 'timeline' | 'verse'
export type GameStat = { id: GameId; players: number; answers: number; correct: number }
export type Dashboard = {
  server_today: string; days: Period
  readers: { total: number; new_in_period: number; active_in_period: number; completed_today: number; best_streak: number; streak_buckets: { label: string; n: number }[]; daily_new: Series }
  reading: { completions: number; views: number; daily_completions: Series; daily_views: Series; devotionals: { published: number; scheduled: number; draft: number }; top: { title: string; views: number; completions: number }[] }
  games: { per_game: GameStat[]; daily: Series; players: number }
  community: { approved: number; approved_in_period: number; pending: number; open_reports: number; reactions: number; daily_comments: Series }
  content: { quiz: number; quiz_levels: { level: number; n: number }[]; who: number; claims: number; verse: number; timeline: number }
}

export const periods: { days: Period; label: string }[] = [{ days: 1, label: 'Hoje' }, { days: 7, label: '7 dias' }, { days: 30, label: '30 dias' }, { days: 90, label: '90 dias' }]
export const gameNames: Record<GameId, string> = { quiz: 'Quiz bíblico', claims: 'Tá na Bíblia ou Tá Amarrado?', who: 'Quem disse isso?', timeline: 'Linha do Tempo', verse: 'Versículo Oculto' }
const gameOrder: GameId[] = ['quiz', 'claims', 'who', 'timeline', 'verse']

const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const day = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
const series = (value: unknown, length: number): Series => {
  if (!Array.isArray(value) || value.length !== length || value.some(item => !item || !day(item.day) || !count(item.n))) throw Error('Invalid dashboard series')
  return value.map(item => ({ day: item.day, n: item.n }))
}
const all = (...values: unknown[]) => values.every(count)

// Valida a resposta e descarta qualquer campo inesperado. Jogos sem atividade no período chegam zerados.
export function parseDashboard(value: unknown, days: Period): Dashboard {
  const v = value as Dashboard
  if (!v || v.days !== days || !day(v.server_today) || !v.readers || !v.reading || !v.games || !v.community || !v.content) throw Error('Invalid dashboard')
  const { readers: r, reading: g, games, community: c, content: k } = v
  if (!all(r.total, r.new_in_period, r.active_in_period, r.completed_today, r.best_streak, g.completions, g.views, games.players,
    c.approved, c.approved_in_period, c.pending, c.open_reports, c.reactions, k.quiz, k.who, k.claims, k.verse, k.timeline,
    g.devotionals?.published, g.devotionals?.scheduled, g.devotionals?.draft)
    || r.active_in_period > r.total || !Array.isArray(r.streak_buckets) || r.streak_buckets.some(b => typeof b?.label !== 'string' || !count(b.n))
    || !Array.isArray(g.top) || g.top.some(t => typeof t?.title !== 'string' || !count(t.views) || !count(t.completions))
    || !Array.isArray(k.quiz_levels) || k.quiz_levels.some(l => !Number.isInteger(l?.level) || !count(l.n))
    || !Array.isArray(games.per_game) || games.per_game.some(p => !gameOrder.includes(p?.id) || !all(p.players, p.answers, p.correct) || p.correct > p.answers)) throw Error('Invalid dashboard')
  const perGame = gameOrder.map(id => {
    const found = games.per_game.find(item => item.id === id)
    return { id, players: found?.players ?? 0, answers: found?.answers ?? 0, correct: found?.correct ?? 0 }
  })
  return {
    server_today: v.server_today, days,
    readers: { total: r.total, new_in_period: r.new_in_period, active_in_period: r.active_in_period, completed_today: r.completed_today, best_streak: r.best_streak,
      streak_buckets: r.streak_buckets.map(b => ({ label: b.label, n: b.n })), daily_new: series(r.daily_new, days) },
    reading: { completions: g.completions, views: g.views, daily_completions: series(g.daily_completions, days), daily_views: series(g.daily_views, days),
      devotionals: { published: g.devotionals.published, scheduled: g.devotionals.scheduled, draft: g.devotionals.draft },
      top: g.top.map(t => ({ title: t.title, views: t.views, completions: t.completions })) },
    games: { per_game: perGame, daily: series(games.daily, days), players: games.players },
    community: { approved: c.approved, approved_in_period: c.approved_in_period, pending: c.pending, open_reports: c.open_reports, reactions: c.reactions, daily_comments: series(c.daily_comments, days) },
    content: { quiz: k.quiz, quiz_levels: k.quiz_levels.map(l => ({ level: l.level, n: l.n })), who: k.who, claims: k.claims, verse: k.verse, timeline: k.timeline },
  }
}

export function createOwnerDashboardRepository(client: Pick<SupabaseClient, 'rpc'>) {
  return {
    async load(days: Period): Promise<Dashboard> {
      if (!periods.some(item => item.days === days)) throw Error('Período inválido.')
      const { data, error } = await client.rpc('get_owner_dashboard', { p_days: days }).abortSignal(AbortSignal.timeout(15000))
      if (error) throw error
      return parseDashboard(data, days)
    },
  }
}
