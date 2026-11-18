import { books } from '../bible/catalog'
import type { WrappedData, WrappedGame } from './repository'

// ---------- Períodos ----------
export type Period = { kind: 'month' | 'year'; year: number; month: number | null }
export const todayInBrazil = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const parts = (iso: string) => { const [year, month, dayOfMonth] = iso.split('-').map(Number); return { year, month, day: dayOfMonth } }

export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
export function periodLabel(period: Period): string { return period.kind === 'year' ? `${period.year}` : monthLabel(period.year, period.month ?? 1) }
export function periodId(period: Period): string { return period.kind === 'year' ? `${period.year}` : `${period.year}-${String(period.month).padStart(2, '0')}` }
export const periodHash = (period: Period) => `#recap/${periodId(period)}`

// Rota: "recap" (período padrão), "recap/2026" (ano) ou "recap/2026-10" (mês).
export function parsePeriod(page: string): Period | null | undefined {
  if (page === 'recap') return undefined
  const [, rest] = page.split('/')
  if (!page.startsWith('recap/') || !rest) return null
  const bits = rest.split('-')
  const year = Number(bits[0])
  if (!/^[0-9]{4}$/.test(bits[0]) || year < 2025 || year > 2100) return null
  if (bits.length === 1) return { kind: 'year', year, month: null }
  const month = Number(bits[1])
  return bits.length === 2 && /^[0-9]{2}$/.test(bits[1]) && month >= 1 && month <= 12 ? { kind: 'month', year, month } : null
}
// Já começou? (o servidor recusa períodos futuros)
export function started(period: Period, today: string): boolean {
  const t = parts(today)
  return period.year < t.year || (period.year === t.year && (period.kind === 'year' || (period.month ?? 1) <= t.month))
}
export function lastClosedMonth(today: string): Period {
  const t = parts(today)
  return t.month === 1 ? { kind: 'month', year: t.year - 1, month: 12 } : { kind: 'month', year: t.year, month: t.month - 1 }
}
// Períodos que valem uma olhada: o mês passado, o mês corrente e os anos (até o ano corrente), do mais novo para o mais antigo.
export function suggestedPeriods(today: string): Period[] {
  const t = parts(today)
  const list: Period[] = []
  for (let back = 0; back < 6; back++) {
    const index = t.year * 12 + (t.month - 1) - back
    const year = Math.floor(index / 12), month = (index % 12) + 1
    if (year >= 2025) list.push({ kind: 'month', year, month })
  }
  for (let year = t.year; year >= Math.max(2025, t.year - 2); year--) list.push({ kind: 'year', year, month: null })
  return list
}
// Entrada na Home: aparece quando um período acabou de fechar (mês: nos primeiros 10 dias; ano: de 15/12 a 31/01).
export function homePrompts(today: string): Period[] {
  const t = parts(today)
  const list: Period[] = []
  if (t.day <= 10 && !(t.year === 2025 && t.month === 1)) list.push(lastClosedMonth(today))
  if (t.month === 12 && t.day >= 15) list.push({ kind: 'year', year: t.year, month: null })
  if (t.month === 1 && t.year > 2025) list.push({ kind: 'year', year: t.year - 1, month: null })
  return list
}

// ---------- Cards ----------
export const gameNames: Record<WrappedGame, string> = {
  quiz: 'Quiz bíblico', mito: 'Tá na Bíblia ou Tá Amarrado?', 'quem-disse': 'Quem disse isso?', 'linha-do-tempo': 'Linha do Tempo', versiculo: 'Versículo Oculto',
}
const norm = (value: string) => value.toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()

// A chave do servidor é o identificador do livro ("joao") ou o nome escrito na passagem ("joão", "1 coríntios").
export function bookName(key: string): string {
  const found = books.find(book => book.id === key || norm(book.name) === norm(key))
  return found ? found.name : key.charAt(0).toLocaleUpperCase('pt-BR') + key.slice(1)
}
export function topBooks(data: WrappedData, limit = 3): { name: string; count: number }[] {
  const merged = new Map<string, number>()
  for (const item of data.books) { const name = bookName(item.key); merged.set(name, (merged.get(name) ?? 0) + item.count) }
  return [...merged.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR')).slice(0, limit)
}
export function bereiaSummary(data: WrappedData) {
  const answered = data.games.reduce((sum, item) => sum + item.answered, 0)
  const correct = data.games.reduce((sum, item) => sum + item.correct, 0)
  // Melhor jogo: maior taxa entre os que tiveram ao menos 3 respostas; se nenhum, o mais jogado.
  const rated = data.games.filter(item => item.answered >= 3).sort((a, b) => b.correct / b.answered - a.correct / a.answered || b.answered - a.answered)
  const best = rated[0] ?? [...data.games].filter(item => item.answered > 0).sort((a, b) => b.answered - a.answered)[0]
  return { answered, correct, percent: answered ? Math.round((100 * correct) / answered) : null, best: best ? { name: gameNames[best.game], answered: best.answered, correct: best.correct } : null }
}

// Marcos de constância (ofensiva): dias seguidos com devocional concluído.
export const milestones = [
  { days: 7, name: 'Base de Bronze', art: 'recap-7' }, { days: 30, name: 'Círculo de Prata', art: 'recap-30' }, { days: 100, name: 'Ofensiva Centenária', art: 'recap-100' },
] as const
export type Milestone = (typeof milestones)[number]
export const milestoneFor = (streak: number): Milestone | null => [...milestones].reverse().find(item => streak >= item.days) ?? null

export type WrappedCard =
  | { kind: 'presence'; empty: boolean; days: number; streak: number; completed: number; milestone: Milestone | null }
  | { kind: 'books'; empty: boolean; items: { name: string; count: number }[] }
  | { kind: 'bereia'; empty: boolean; answered: number; correct: number; percent: number | null; best: { name: string; answered: number; correct: number } | null }
  | { kind: 'verse'; empty: boolean; reference: string; title: string; opens: number }

export function buildCards(data: WrappedData): WrappedCard[] {
  const items = topBooks(data)
  const bereia = bereiaSummary(data)
  return [
    { kind: 'presence', empty: data.presence.days === 0, days: data.presence.days, streak: data.presence.longest_streak, completed: data.presence.completed, milestone: milestoneFor(data.presence.longest_streak) },
    { kind: 'books', empty: items.length === 0, items },
    { kind: 'bereia', empty: bereia.answered === 0, answered: bereia.answered, correct: bereia.correct, percent: bereia.percent, best: bereia.best },
    { kind: 'verse', empty: !data.verse, reference: data.verse?.reference ?? '', title: data.verse?.title ?? '', opens: data.verse?.opens ?? 0 },
  ]
}
// A chama do primeiro card muda com o marco de ofensiva; os outros cards têm arte fixa.
export const artFor = (card: WrappedCard): string => (card.kind === 'presence' ? (card.milestone?.art ?? 'flame') : { books: 'biblia', bereia: 'trophy', verse: 'palavra' }[card.kind])
export const cardTitle: Record<WrappedCard['kind'], string> = {
  presence: 'Seus dias na Presença', books: 'Livros mais lidos', bereia: 'Sua taxa de acerto na Bereia', verse: 'Versículo mais revisitado',
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
export function cardText(card: WrappedCard): { headline: string; detail: string } {
  switch (card.kind) {
    case 'presence': return card.empty
      ? { headline: 'Nenhum dia ainda', detail: 'Conclua um devocional e comece a sua sequência.' }
      : { headline: plural(card.days, 'dia', 'dias'), detail: `${plural(card.completed, 'devocional concluído', 'devocionais concluídos')}${card.streak > 1 ? ` · maior sequência: ${card.streak} dias seguidos` : ''}` }
    case 'books': return card.empty
      ? { headline: 'Sem leituras', detail: 'Abra um devocional para ver os livros que mais passaram por você.' }
      : { headline: card.items[0].name, detail: card.items.map(item => `${item.name} (${plural(item.count, 'leitura', 'leituras')})`).join(' · ') }
    case 'bereia': return card.empty || card.percent === null
      ? { headline: 'Sem respostas', detail: 'Jogue um quiz na Bereia para ver a sua taxa de acerto.' }
      : { headline: `${card.percent}%`, detail: `${card.correct} acertos em ${plural(card.answered, 'resposta', 'respostas')}${card.best ? ` · melhor em ${card.best.name}` : ''}` }
    case 'verse': return card.empty
      ? { headline: 'Nada revisitado', detail: 'Quando você abrir o mesmo devocional mais de uma vez, ele aparece aqui.' }
      : { headline: card.reference, detail: `${card.title} · aberto ${plural(card.opens, 'vez', 'vezes')}` }
  }
}
