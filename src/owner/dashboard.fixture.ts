// Dados fictícios para os testes do dashboard.
export const days = (n: number, value = 0) => Array.from({ length: n }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, '0')}`, n: value }))
export const payload = (n: 1 | 7 | 30 | 90 = 7) => ({
  server_today: '2026-11-12', days: n,
  readers: { total: 10, new_in_period: 2, active_in_period: 4, completed_today: 1, best_streak: 5, streak_buckets: [{ label: 'Sem sequência', n: 8 }, { label: '1 a 6 dias', n: 2 }], daily_new: days(n) },
  reading: { completions: 6, views: 12, daily_completions: days(n), daily_views: days(n), devotionals: { published: 3, scheduled: 1, draft: 2 }, top: [{ title: 'Leitura fictícia', views: 5, completions: 3 }] },
  games: { per_game: [{ id: 'quiz', players: 3, answers: 10, correct: 7 }], daily: days(n), players: 3 },
  community: { approved: 4, approved_in_period: 1, pending: 2, open_reports: 1, reactions: 9, daily_comments: days(n) },
  content: { quiz: 99, quiz_levels: [{ level: 1, n: 23 }], who: 30, claims: 24, verse: 16, timeline: 61 },
})
