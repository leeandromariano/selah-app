import { books } from '../bible/catalog'
import { bibleAvailable } from '../bible/availability'

// Planos de leitura bíblica. Os capítulos de cada dia são calculados aqui (sem tabela): os capítulos, na ordem da Bíblia,
// são repartidos em partes quase iguais, então o mesmo plano é sempre igual para todos.
export type PlanId = 'biblia-1-ano' | 'antigo-testamento-150-dias' | 'novo-testamento-90-dias'
export type ChapterRef = { book: string; chapter: number }
export type PlanInfo = { id: PlanId; title: string; short: string; days: number; scope: 'all' | 'at' | 'nt'; blurb: string }

export const plans: Record<PlanId, PlanInfo> = {
  'biblia-1-ano': { id: 'biblia-1-ano', title: 'A Bíblia toda em 1 ano', short: 'Bíblia em 1 ano', days: 365, scope: 'all', blurb: 'Do Gênesis ao Apocalipse em 365 dias, cerca de 3 a 4 capítulos por dia.' },
  'antigo-testamento-150-dias': { id: 'antigo-testamento-150-dias', title: 'Antigo Testamento em 5 meses', short: 'Antigo Testamento em 150 dias', days: 150, scope: 'at', blurb: 'De Gênesis a Malaquias em 150 dias, cerca de 6 a 7 capítulos por dia.' },
  'novo-testamento-90-dias': { id: 'novo-testamento-90-dias', title: 'Novo Testamento em 3 meses', short: 'Novo Testamento em 90 dias', days: 90, scope: 'nt', blurb: 'De Mateus ao Apocalipse em 90 dias, cerca de 3 capítulos por dia.' },
}
export const planOrder: PlanId[] = ['biblia-1-ano', 'antigo-testamento-150-dias', 'novo-testamento-90-dias']
export const isPlanId = (value: unknown): value is PlanId => typeof value === 'string' && Object.hasOwn(plans, value)

const chapterCache = new Map<PlanId, ChapterRef[]>()
export function planChapters(plan: PlanId): ChapterRef[] {
  const cached = chapterCache.get(plan)
  if (cached) return cached
  const list = books.filter(book => plans[plan].scope === 'all' || book.testament === (plans[plan].scope === 'nt' ? 'Novo Testamento' : 'Antigo Testamento')).flatMap(book => Array.from({ length: book.chapters }, (_, i) => ({ book: book.id, chapter: i + 1 })))
  chapterCache.set(plan, list)
  return list
}

// Capítulos do dia (1 a N), em partes consecutivas e quase iguais.
export function dayChapters(plan: PlanId, day: number): ChapterRef[] {
  const { days } = plans[plan]
  if (!Number.isInteger(day) || day < 1 || day > days) return []
  const all = planChapters(plan)
  return all.slice(Math.floor(((day - 1) * all.length) / days), Math.floor((day * all.length) / days))
}

// "Gênesis 1–3", "Gênesis 50 · Êxodo 1–2"
export function formatChapters(refs: ChapterRef[]): string {
  const groups: { book: string; from: number; to: number }[] = []
  for (const ref of refs) {
    const last = groups[groups.length - 1]
    if (last && last.book === ref.book && last.to + 1 === ref.chapter) last.to = ref.chapter
    else groups.push({ book: ref.book, from: ref.chapter, to: ref.chapter })
  }
  return groups.map(group => `${books.find(book => book.id === group.book)?.name ?? group.book} ${group.from === group.to ? group.from : `${group.from}–${group.to}`}`).join(' · ')
}

// Primeiro dia ainda não lido; depois do último, o plano está concluído (null).
export function currentDay(plan: PlanId, completed: number[]): number | null {
  const done = new Set(completed)
  for (let day = 1; day <= plans[plan].days; day++) if (!done.has(day)) return day
  return null
}
export function progressPercent(plan: PlanId, completed: number[]): number {
  return Math.round((new Set(completed.filter(day => day >= 1 && day <= plans[plan].days)).size / plans[plan].days) * 100)
}
// Dia de calendário do plano (1 = o dia da adesão), para dizer se o leitor está em dia, adiantado ou com dias a recuperar.
export function calendarDay(startedOn: string, today: string): number {
  const [y1, m1, d1] = startedOn.split('-').map(Number), [y2, m2, d2] = today.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000) + 1
}
export const planTranslation = () => (bibleAvailable ? 'nvt' : 'demonstracao')
export const chapterHref = (ref: ChapterRef) => `#biblia/${planTranslation()}/${ref.book}/${ref.chapter}`
