import { describe, expect, it } from 'vitest'
import { calendarDay, currentDay, dayChapters, formatChapters, planChapters, progressPercent, plans } from './plans'
import type { PlanId } from './plans'

const ids: PlanId[] = ['biblia-1-ano', 'antigo-testamento-150-dias', 'novo-testamento-90-dias']

describe('planos de leitura: divisão dos capítulos', () => {
  it('a Bíblia tem 1189 capítulos, o Antigo Testamento 929 e o Novo Testamento 260', () => {
    expect(planChapters('biblia-1-ano')).toHaveLength(1189)
    expect(planChapters('antigo-testamento-150-dias')).toHaveLength(929)
    expect(planChapters('antigo-testamento-150-dias').at(-1)).toEqual({ book: 'malaquias', chapter: 4 })
    expect(planChapters('novo-testamento-90-dias')).toHaveLength(260)
    expect(planChapters('novo-testamento-90-dias')[0]).toEqual({ book: 'mateus', chapter: 1 })
  })
  it.each(ids)('%s: os dias cobrem todos os capítulos, na ordem, sem repetir nem pular', plan => {
    const joined = Array.from({ length: plans[plan].days }, (_, i) => dayChapters(plan, i + 1)).flat()
    expect(joined).toEqual(planChapters(plan))
  })
  it.each(ids)('%s: nenhum dia fica vazio e a carga é parecida', plan => {
    const sizes = Array.from({ length: plans[plan].days }, (_, i) => dayChapters(plan, i + 1).length)
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(1)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
  })
  it('o primeiro dia começa em Gênesis 1 e o último termina em Apocalipse 22', () => {
    expect(dayChapters('biblia-1-ano', 1)[0]).toEqual({ book: 'genesis', chapter: 1 })
    expect(dayChapters('biblia-1-ano', 365).at(-1)).toEqual({ book: 'apocalipse', chapter: 22 })
    expect(dayChapters('novo-testamento-90-dias', 90).at(-1)).toEqual({ book: 'apocalipse', chapter: 22 })
    expect(dayChapters('antigo-testamento-150-dias', 1)[0]).toEqual({ book: 'genesis', chapter: 1 })
    expect(dayChapters('antigo-testamento-150-dias', 150).at(-1)).toEqual({ book: 'malaquias', chapter: 4 })
  })
  it('dia fora do plano não tem leitura', () => {
    expect(dayChapters('biblia-1-ano', 0)).toEqual([])
    expect(dayChapters('biblia-1-ano', 366)).toEqual([])
    expect(dayChapters('novo-testamento-90-dias', 91)).toEqual([])
    expect(dayChapters('antigo-testamento-150-dias', 151)).toEqual([])
    expect(dayChapters('biblia-1-ano', 1.5)).toEqual([])
  })
})

describe('planos de leitura: texto e progresso', () => {
  it('junta capítulos seguidos e separa livros', () => {
    expect(formatChapters([{ book: 'genesis', chapter: 1 }, { book: 'genesis', chapter: 2 }, { book: 'genesis', chapter: 3 }])).toBe('Gênesis 1–3')
    expect(formatChapters([{ book: 'genesis', chapter: 50 }, { book: 'exodo', chapter: 1 }, { book: 'exodo', chapter: 2 }])).toBe('Gênesis 50 · Êxodo 1–2')
    expect(formatChapters([{ book: 'salmos', chapter: 23 }])).toBe('Salmos 23')
  })
  it('o dia atual é o primeiro ainda não lido, mesmo com lacunas', () => {
    expect(currentDay('biblia-1-ano', [])).toBe(1)
    expect(currentDay('biblia-1-ano', [1, 2, 4])).toBe(3)
    expect(currentDay('novo-testamento-90-dias', Array.from({ length: 90 }, (_, i) => i + 1))).toBeNull()
  })
  it('o percentual ignora dias repetidos ou fora do plano', () => {
    expect(progressPercent('novo-testamento-90-dias', [])).toBe(0)
    expect(progressPercent('novo-testamento-90-dias', [1, 1, 2, 999])).toBe(2)
    expect(progressPercent('novo-testamento-90-dias', Array.from({ length: 45 }, (_, i) => i + 1))).toBe(50)
  })
  it('o dia de calendário conta o dia da adesão como o dia 1, também na virada de mês e de ano', () => {
    expect(calendarDay('2026-11-17', '2026-11-17')).toBe(1)
    expect(calendarDay('2026-11-17', '2026-11-20')).toBe(4)
    expect(calendarDay('2026-12-30', '2027-01-02')).toBe(4)
  })
})
