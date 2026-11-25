import { describe, expect, it, vi } from 'vitest'
import { artFor, bereiaSummary, bookName, buildCards, cardText, homePrompts, lastClosedMonth, milestoneFor, monthLabel, parsePeriod, periodHash, started, suggestedPeriods, topBooks } from './model'
import { createWrappedRepository } from './repository'
import type { WrappedData } from './repository'
import { drawWrappedCard } from './image'
import type { WrappedContext } from './image'

const base: WrappedData = {
  kind: 'month', year: 2026, month: 10, start: '2026-10-01', end: '2026-10-31', partial: false,
  presence: { days: 12, completed: 13, longest_streak: 5 },
  books: [{ key: 'joao', count: 3 }, { key: 'joão', count: 2 }, { key: 'salmos', count: 4 }, { key: '1 coríntios', count: 1 }, { key: 'livro que nao existe', count: 1 }],
  games: [{ game: 'quiz', answered: 10, correct: 8 }, { game: 'mito', answered: 2, correct: 2 }, { game: 'quem-disse', answered: 0, correct: 0 }, { game: 'linha-do-tempo', answered: 5, correct: 3 }, { game: 'versiculo', answered: 0, correct: 0 }],
  verse: { reference: 'João 3:16-18', title: 'Amor que alcança', opens: 4 },
}
const answer = (data: unknown, error: unknown = null) => {
  const rpc = vi.fn(() => ({ abortSignal: async () => ({ data, error }) }))
  return { rpc, repository: createWrappedRepository({ rpc } as never) }
}
const payload = { kind: 'month', year: 2026, month: 10, start: '2026-10-01', end: '2026-10-31', partial: false, presence: base.presence, books: base.books, bereia: { games: base.games }, verse: base.verse }

describe('Wrapped: repositório', () => {
  it('lê o período e guarda só os campos conhecidos', async () => {
    const { rpc, repository } = answer({ ...payload, segredo: 'x', verse: { ...base.verse, extra: 1 } })
    const data = await repository.get('month', 2026, 10)
    expect(rpc).toHaveBeenCalledWith('get_my_wrapped', { p_kind: 'month', p_year: 2026, p_month: 10 })
    expect(JSON.stringify(data)).not.toContain('segredo')
    expect(data.verse).toEqual(base.verse)
    expect(data.games).toHaveLength(5)
  })
  it.each([['tipo', 'semana', 2026, 3], ['ano antes do app', 'month', 2024, 3], ['mês 13', 'month', 2026, 13], ['mês no ano', 'year', 2026, 3], ['mês ausente', 'month', 2026, null]])('recusa %s antes de chamar o servidor', async (_n, kind, year, month) => {
    const { rpc, repository } = answer(payload)
    await expect(repository.get(kind as never, year, month as never)).rejects.toThrow('Período inválido')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('descarta jogos desconhecidos, contagens impossíveis e rejeita resposta de outro período', async () => {
    const dirty = { ...payload, bereia: { games: [{ game: 'quiz', answered: 2, correct: 5 }, { game: 'xadrez', answered: 3, correct: 1 }, { game: 'mito', answered: 4, correct: 1 }] }, books: [{ key: '', count: 1 }, { key: 'joao', count: -1 }, { key: 'salmos', count: 2 }] }
    const data = await answer(dirty).repository.get('month', 2026, 10)
    expect(data.games).toEqual([{ game: 'mito', answered: 4, correct: 1 }])
    expect(data.books).toEqual([{ key: 'salmos', count: 2 }])
    await expect(answer({ ...payload, month: 9 }).repository.get('month', 2026, 10)).rejects.toThrow('Resposta inválida')
    await expect(answer({ ...payload, presence: { days: 2, completed: 2, longest_streak: 5 } }).repository.get('month', 2026, 10)).rejects.toThrow('Resposta inválida')
  })
  it('mostra mensagens do servidor feitas para o leitor e esconde as técnicas', async () => {
    await expect(answer(null, { message: 'Este período ainda não começou.' }).repository.get('year', 2100, null)).rejects.toThrow('Este período ainda não começou')
    await expect(answer(null, { message: 'permission denied for table x' }).repository.get('month', 2026, 10)).rejects.toThrow('Não foi possível montar o seu Wrapped agora')
  })
})

describe('Wrapped: períodos', () => {
  it('entende as rotas e recusa as inválidas', () => {
    expect(parsePeriod('recap')).toBeUndefined()
    expect(parsePeriod('recap/2026-10')).toEqual({ kind: 'month', year: 2026, month: 10 })
    expect(parsePeriod('recap/2026')).toEqual({ kind: 'year', year: 2026, month: null })
    for (const bad of ['recap/', 'recap/2026-13', 'recap/2026-1', 'recap/2024', 'recap/abcd', 'recap/2026-10-01', 'recap/2026-00', 'wrapped/2026']) expect(parsePeriod(bad)).toBeNull()
    expect(periodHash({ kind: 'month', year: 2026, month: 3 })).toBe('#recap/2026-03')
  })
  it('o mês passado volta para dezembro em janeiro e rotula em português', () => {
    expect(lastClosedMonth('2026-11-17')).toEqual({ kind: 'month', year: 2026, month: 10 })
    expect(lastClosedMonth('2027-01-05')).toEqual({ kind: 'month', year: 2026, month: 12 })
    expect(monthLabel(2026, 10)).toBe('outubro de 2026')
  })
  it('não oferece nem aceita período que ainda não começou', () => {
    expect(started({ kind: 'month', year: 2026, month: 11 }, '2026-11-17')).toBe(true)
    expect(started({ kind: 'month', year: 2026, month: 12 }, '2026-11-17')).toBe(false)
    expect(started({ kind: 'year', year: 2026, month: null }, '2026-01-01')).toBe(true)
    expect(started({ kind: 'year', year: 2027, month: null }, '2026-12-31')).toBe(false)
    const list = suggestedPeriods('2026-02-10')
    expect(list.filter(item => item.kind === 'month').map(item => `${item.year}-${item.month}`)).toEqual(['2026-2', '2026-1', '2025-12', '2025-11', '2025-10', '2025-9'])
    expect(list.every(item => started(item, '2026-02-10'))).toBe(true)
  })
  it('só lembra na Home quando um período acabou de fechar', () => {
    expect(homePrompts('2026-11-04')).toEqual([{ kind: 'month', year: 2026, month: 10 }])
    expect(homePrompts('2026-11-17')).toEqual([])
    expect(homePrompts('2026-12-20')).toEqual([{ kind: 'year', year: 2026, month: null }])
    expect(homePrompts('2027-01-03')).toEqual([{ kind: 'month', year: 2026, month: 12 }, { kind: 'year', year: 2026, month: null }])
    expect(homePrompts('2027-01-20')).toEqual([{ kind: 'year', year: 2026, month: null }])
    expect(homePrompts('2025-01-05')).toEqual([])
  })
})

describe('Wrapped: cards', () => {
  it('junta o mesmo livro escrito de formas diferentes e ordena pelos mais lidos', () => {
    expect(bookName('joao')).toBe('João')
    expect(bookName('joão')).toBe('João')
    expect(bookName('1 coríntios')).toBe('1 Coríntios')
    expect(bookName('livro estranho')).toBe('Livro estranho')
    expect(topBooks(base)).toEqual([{ name: 'João', count: 5 }, { name: 'Salmos', count: 4 }, { name: '1 Coríntios', count: 1 }])
    expect(topBooks(base, 1)).toHaveLength(1)
  })
  it('calcula a taxa de acerto e o melhor jogo (com pelo menos 3 respostas)', () => {
    expect(bereiaSummary(base)).toEqual({ answered: 17, correct: 13, percent: 76, best: { name: 'Quiz bíblico', answered: 10, correct: 8 } })
    const few = { ...base, games: [{ game: 'mito' as const, answered: 2, correct: 2 }, { game: 'quiz' as const, answered: 1, correct: 0 }] }
    expect(bereiaSummary(few).best?.name).toBe('Tá na Bíblia ou Tá Amarrado?')
    expect(bereiaSummary({ ...base, games: [] })).toEqual({ answered: 0, correct: 0, percent: null, best: null })
  })
  it('monta os 4 cards e os textos, com mensagens amigáveis quando não há dados', () => {
    const cards = buildCards(base)
    expect(cards.map(card => card.kind)).toEqual(['presence', 'books', 'bereia', 'verse'])
    expect(cards.every(card => !card.empty)).toBe(true)
    expect(cardText(cards[0])).toEqual({ headline: '12 dias', detail: '13 devocionais concluídos · maior sequência: 5 dias seguidos' })
    expect(cardText(cards[2]).headline).toBe('76%')
    expect(cardText(cards[3]).headline).toBe('João 3:16-18')
    const empty = buildCards({ ...base, presence: { days: 0, completed: 0, longest_streak: 0 }, books: [], games: [], verse: null })
    expect(empty.every(card => card.empty)).toBe(true)
    expect(empty.map(card => cardText(card).headline)).toEqual(['Nenhum dia ainda', 'Sem leituras', 'Sem respostas', 'Nada revisitado'])
    expect(cardText(buildCards({ ...base, presence: { days: 1, completed: 1, longest_streak: 1 } })[0]).headline).toBe('1 dia')
  })
})

describe('Recap: marcos de constância', () => {
  it('o marco é o maior alcançado pela sequência de dias seguidos', () => {
    expect(milestoneFor(6)).toBeNull()
    expect(milestoneFor(7)?.name).toBe('Base de Bronze')
    expect(milestoneFor(29)?.name).toBe('Base de Bronze')
    expect(milestoneFor(30)?.name).toBe('Círculo de Prata')
    expect(milestoneFor(99)?.name).toBe('Círculo de Prata')
    expect(milestoneFor(100)?.name).toBe('Ofensiva Centenária')
    expect(milestoneFor(365)?.art).toBe('recap-100')
  })
  it('a arte do primeiro card muda com o marco; os outros têm arte fixa', () => {
    const art = (streak: number) => artFor(buildCards({ ...base, presence: { days: Math.max(streak, 1), completed: 1, longest_streak: streak } })[0])
    expect([art(1), art(7), art(30), art(100)]).toEqual(['flame', 'recap-7', 'recap-30', 'recap-100'])
    expect(buildCards(base).slice(1).map(artFor)).toEqual(['biblia', 'trophy', 'palavra'])
  })
})

describe('Wrapped: imagem do card', () => {
  function recorder() {
    const texts: string[] = []
    const images: unknown[] = []
    const gradient = { addColorStop: () => undefined }
    const ctx = { fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', fillRect: () => undefined, beginPath: () => undefined, arc: () => undefined, fill: () => undefined, stroke: () => undefined,
      fillText: (text: string) => { texts.push(text) }, createLinearGradient: () => gradient, createRadialGradient: () => gradient, drawImage: (image: unknown) => { images.push(image) }, measureText: (text: string) => ({ width: text.length * 24 }) } as unknown as WrappedContext
    return { ctx, texts, images }
  }
  it('desenha o título, o número, a legenda e a arte', () => {
    const { ctx, texts, images } = recorder()
    drawWrappedCard(ctx, buildCards(base)[0], 'Outubro de 2026', 'coram.app', { art: true })
    expect(texts).toContain('RECAP CORAM')
    expect(texts).toContain('Outubro de 2026')
    expect(texts).toContain('Seus dias na Presença')
    expect(texts).toContain('12 dias')
    expect(texts).toContain('coram.app')
    expect(images).toHaveLength(1)
  })
  it('quebra a legenda longa em linhas e funciona sem a arte', () => {
    const { ctx, texts, images } = recorder()
    drawWrappedCard(ctx, buildCards(base)[1], 'Ano 2026', 'coram.app')
    expect(images).toHaveLength(0)
    expect(texts.filter(text => text.includes('·') && text.length < 60).length).toBeGreaterThan(0)
  })
  it('escreve o nome do marco de ofensiva no card de dias', () => {
    const { ctx, texts } = recorder()
    drawWrappedCard(ctx, buildCards({ ...base, presence: { days: 40, completed: 40, longest_streak: 31 } })[0], 'Ano 2026', 'coram.app')
    expect(texts).toContain('Círculo de Prata')
    const none = recorder()
    drawWrappedCard(none.ctx, buildCards({ ...base, presence: { days: 3, completed: 3, longest_streak: 3 } })[0], 'Ano 2026', 'coram.app')
    expect(none.texts).not.toContain('Base de Bronze')
  })
  it('um card sem dados mostra a mensagem amigável', () => {
    const { ctx, texts } = recorder()
    drawWrappedCard(ctx, buildCards({ ...base, verse: null })[3], 'Ano 2026', 'coram.app')
    expect(texts).toContain('Nada revisitado')
  })
})
