import { describe, expect, it, vi } from 'vitest'
import { createOwnerDashboardRepository, parseDashboard } from './dashboard'
import { modeForPage, modes } from './modes'
import { percent } from './format'
import { days, payload } from './dashboard.fixture'

function client(data: unknown, error: unknown = null) {
  const rpc = vi.fn(() => ({ abortSignal: async () => ({ data, error }) }))
  return { rpc, repository: createOwnerDashboardRepository({ rpc } as never) }
}

describe('dashboard do owner (dados)', () => {
  it('carrega o período escolhido, completa os jogos sem atividade com zero e descarta campos extras', async () => {
    const { rpc, repository } = client({ ...payload(7), segredo: 'x' })
    const d = await repository.load(7)
    expect(rpc).toHaveBeenCalledWith('get_owner_dashboard', { p_days: 7 })
    expect(d).not.toHaveProperty('segredo')
    expect(d.games.per_game.map(item => item.id)).toEqual(['quiz', 'claims', 'who', 'timeline', 'verse'])
    expect(d.games.per_game.find(item => item.id === 'verse')).toEqual({ id: 'verse', players: 0, answers: 0, correct: 0 })
  })
  it('recusa período inválido e propaga erro de acesso', async () => {
    const { rpc, repository } = client(payload())
    await expect(repository.load(15 as never)).rejects.toThrow('Período inválido')
    expect((await client(payload(1)).repository.load(1)).reading.daily_views).toHaveLength(1)
    expect(rpc).not.toHaveBeenCalled()
    await expect(client(null, { code: '42501' }).repository.load(7)).rejects.toEqual({ code: '42501' })
  })
  it('recusa respostas inconsistentes', () => {
    expect(() => parseDashboard({ ...payload(7), days: 30 }, 7)).toThrow('Invalid dashboard')
    expect(() => parseDashboard({ ...payload(7), readers: { ...payload(7).readers, active_in_period: 11 } }, 7)).toThrow('Invalid dashboard')
    expect(() => parseDashboard({ ...payload(7), games: { ...payload(7).games, per_game: [{ id: 'quiz', players: 1, answers: 1, correct: 2 }] } }, 7)).toThrow('Invalid dashboard')
    expect(() => parseDashboard({ ...payload(7), reading: { ...payload(7).reading, daily_views: days(3) } }, 7)).toThrow('Invalid dashboard')
  })
})

describe('áreas do painel', () => {
  it('liga cada rota do owner a uma área, com a visão geral como padrão', () => {
    expect(modes.map(item => item.id)).toEqual(['geral', 'leitores', 'bereia', 'reflexoes', 'conteudo'])
    expect(modeForPage('owner')).toBe('geral')
    expect(modeForPage('owner/comunidade')).toBe('leitores')
    expect(modeForPage('owner/bereia')).toBe('bereia')
    expect(modeForPage('owner/moderacao')).toBe('reflexoes')
    expect(modeForPage('owner/perguntas')).toBe('conteudo')
    expect(modeForPage('owner/publicadores')).toBe('conteudo')
  })
  it('calcula percentuais sem dividir por zero', () => {
    expect(percent(1, 4)).toBe(25)
    expect(percent(0, 0)).toBe(0)
  })
})
