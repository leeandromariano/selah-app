import { describe, expect, it, vi } from 'vitest'
import { createDuelRepository } from './repository'
import type { DuelPlayer } from './repository'
import { drawDuelCard } from './card'
import type { CardContext } from './card'
import { duelThemeName, duelUrl, inviteMessage, playerName, rival, secondsText, verdict, whatsappLink } from './share'

const code = 'a1b2c3d4e5'
const q = (n: number) => ({ id: `1111111${n}-1111-4111-8111-111111111111`, prompt: `Pergunta ${n}?`, options: ['a', 'b', 'c', 'd'] })
function client(data: unknown, error: unknown = null) {
  const rpc = vi.fn(() => ({ abortSignal: async () => ({ data, error }) }))
  return { rpc, repository: createDuelRepository({ rpc } as never) }
}
const state = { code, mode: 'novo', level: 2, size: 5, creator: 'ana', is_creator: false, finished: false, questions: [1, 2, 3, 4, 5].map(q), answers: [] }

describe('Duelo: repositório', () => {
  it('cria o duelo com os parâmetros validados e devolve só o código', async () => {
    const { rpc, repository } = client({ code, extra: 'x' })
    await expect(repository.create('biblia', 3, 10)).resolves.toBe(code)
    expect(rpc).toHaveBeenCalledWith('duel_create', { p_mode: 'biblia', p_level: 3, p_size: 10 })
  })
  it.each([['modalidade', 'todas', 1, 5], ['nível', 'novo', 7, 5], ['tamanho', 'novo', 1, 7]])('recusa %s inválido antes de chamar o servidor', async (_n, mode, level, size) => {
    const { rpc, repository } = client({ code })
    await expect(repository.create(mode as never, level as never, size as never)).rejects.toThrow('válidos')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('mostra as mensagens do servidor que são para o leitor e esconde as técnicas', async () => {
    await expect(client(null, { message: 'Ainda não há perguntas suficientes nesta combinação.' }).repository.create('novo', 4, 5)).rejects.toThrow('Ainda não há perguntas suficientes')
    await expect(client(null, { message: 'relation "quiz_duels" does not exist' }).repository.create('novo', 4, 5)).rejects.toThrow('Não foi possível criar o duelo agora')
    await expect(client(null, { message: 'Duelo não encontrado ou expirado.' }).repository.open(code)).rejects.toThrow('Duelo não encontrado ou expirado')
  })
  it('abre o duelo guardando só os campos conhecidos: nunca a resposta certa de uma pergunta ainda não respondida', async () => {
    const { repository } = client({ ...state, questions: state.questions.map(item => ({ ...item, correct_index: 2 })) })
    const opened = await repository.open(code)
    expect(opened.questions).toHaveLength(5)
    expect(JSON.stringify(opened.questions)).not.toContain('correct_index')
    expect(opened.creator).toBe('ana')
  })
  it('recusa código malformado sem chamar o servidor e resposta fora do formato', async () => {
    const { rpc, repository } = client(state)
    await expect(repository.open('../../x')).rejects.toThrow('Duelo não encontrado')
    expect(rpc).not.toHaveBeenCalled()
    await expect(client({ ...state, questions: state.questions.slice(0, 3) }).repository.open(code)).rejects.toThrow('Resposta inválida')
    await expect(client({ ...state, questions: [{ ...q(1), options: ['a'] }, ...state.questions.slice(1)] }).repository.open(code)).rejects.toThrow('Resposta inválida')
  })
  it('responde com o tempo limitado a 15 s e confere a coerência da resposta', async () => {
    const { rpc, repository } = client({ correct: true, correct_index: 1, reference: 'João 3:16', counted: true, finished: false })
    await repository.answer(code, q(1).id, 1, 99999)
    expect(rpc).toHaveBeenCalledWith('duel_answer', { p_code: code, p_question_id: q(1).id, p_selected: 1, p_elapsed_ms: 15000 })
    await expect(client({ correct: true, correct_index: 2, reference: 'x', counted: true, finished: false }).repository.answer(code, q(1).id, 1, 1000)).rejects.toThrow('Resposta inválida')
    await expect(repository.answer(code, q(1).id, 9, 1000)).rejects.toThrow('Resposta inválida')
  })
  it('o tempo esgotado (-1) é uma resposta válida e errada', async () => {
    const { repository } = client({ correct: false, correct_index: 2, reference: 'João 3:16', counted: true, finished: false })
    await expect(repository.answer(code, q(1).id, -1, 15000)).resolves.toMatchObject({ correct: false })
  })
  it('lê o placar e descarta apelidos fora do padrão', async () => {
    const { repository } = client({ code, mode: 'novo', level: 2, size: 5, waiting: 1, players: [{ username: 'ana', correct: 4, total_ms: 30000, is_me: false, is_creator: true }, { username: 'Nome Ruim!', correct: 3, total_ms: 41000, is_me: true, is_creator: false }] })
    const result = await repository.result(code)
    expect(result.players.map(player => player.username)).toEqual(['ana', null])
    await expect(client({ code, mode: 'novo', level: 2, size: 5, waiting: 0, players: [{ username: 'ana', correct: 9, total_ms: 1, is_me: false, is_creator: true }] }).repository.result(code)).rejects.toThrow('Resposta inválida')
  })
  it('lista meus duelos ignorando itens malformados', async () => {
    const good = { code, mode: 'novo', level: 2, size: 5, created_at: '2026-11-18T10:00:00Z', creator: 'ana', is_creator: false, finished: true, correct: 4 }
    const { repository } = client([good, { ...good, code: 'ruim' }, null])
    await expect(repository.mine()).resolves.toEqual([good])
  })
})

const me: DuelPlayer = { username: 'beto', correct: 4, total_ms: 38000, is_me: true, is_creator: false }
const ana: DuelPlayer = { username: 'ana', correct: 3, total_ms: 30000, is_me: false, is_creator: true }

describe('Duelo: convite e comparação', () => {
  it('monta o link, o convite do WhatsApp e os textos', () => {
    expect(duelUrl('https://coram.app', code)).toBe(`https://coram.app/#bereia/duelo/${code}`)
    const message = inviteMessage(duelUrl('https://coram.app', code), 'Novo Testamento · Intermediário', 5, 4)
    expect(message).toContain('Eu fiz 4 de 5.')
    expect(whatsappLink(message)).toBe(`https://wa.me/?text=${encodeURIComponent(message)}`)
    expect(inviteMessage('https://x', 'Tema', 10)).not.toContain('Eu fiz')
    expect(duelThemeName('antigo', 4)).toBe('Antigo Testamento · Bigode grosso')
    expect(secondsText(38000)).toBe('38,0 s')
    expect(playerName(me)).toBe('Você')
    expect(playerName(ana)).toBe('@ana')
    expect(playerName({ username: null, is_me: false })).toBe('Jogador')
  })
  it('vence quem acerta mais; no empate, quem respondeu mais rápido; igual é empate', () => {
    expect(verdict(me, ana)).toBe('win')
    expect(verdict(ana, me)).toBe('lose')
    expect(verdict({ ...me, correct: 3 }, ana)).toBe('lose')
    expect(verdict({ ...me, correct: 3, total_ms: 20000 }, ana)).toBe('win')
    expect(verdict({ ...me, correct: 3, total_ms: 30000 }, ana)).toBe('tie')
  })
  it('o rival é o criador para quem aceitou o convite e o melhor dos outros para quem criou', () => {
    const caio: DuelPlayer = { username: 'caio', correct: 5, total_ms: 20000, is_me: false, is_creator: false }
    expect(rival([caio, me, ana])).toEqual(ana)
    expect(rival([caio, { ...ana, is_me: true }, me])).toEqual(caio)
    expect(rival([{ ...ana, is_me: true }])).toBeNull()
    expect(rival([ana])).toBeNull()
  })
})

describe('Duelo: card do placar', () => {
  function recorder() {
    const texts: string[] = []
    const gradient = { addColorStop: () => undefined }
    const ctx = { fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', fillRect: () => undefined, beginPath: () => undefined, arc: () => undefined, fill: () => undefined, stroke: () => undefined,
      fillText: (text: string) => { texts.push(text) }, createLinearGradient: () => gradient, createRadialGradient: () => gradient } as unknown as CardContext
    return { ctx, texts }
  }
  it('mostra o resultado, os dois placares e o convite quando há rival', () => {
    const { ctx, texts } = recorder()
    drawDuelCard(ctx, { theme: 'Novo Testamento · Intermediário', size: 5, me, rival: ana, host: 'coram.app' })
    expect(texts).toContain('Ganhei o duelo! 🏆')
    expect(texts).toContain('4')
    expect(texts).toContain('3')
    expect(texts).toContain('Você')
    expect(texts).toContain('@ana')
    expect(texts).toContain('Aceita o desafio?')
    expect(texts.some(text => text.includes('coram.app'))).toBe(true)
  })
  it('sem rival, desafia quem ver o card', () => {
    const { ctx, texts } = recorder()
    drawDuelCard(ctx, { theme: 'Bíblia toda · Iniciante', size: 10, me: { ...me, correct: 8 }, rival: null, host: 'coram.app' })
    expect(texts).toContain('Fiz o meu. E você?')
    expect(texts).toContain('8')
    expect(texts).not.toContain('×')
  })
  it('mostra a derrota e o empate com honestidade', () => {
    const lose = recorder(); drawDuelCard(lose.ctx, { theme: 't', size: 5, me: { ...me, correct: 1 }, rival: ana, host: 'h' })
    expect(lose.texts).toContain('Perdi dessa vez 😅')
    const tie = recorder(); drawDuelCard(tie.ctx, { theme: 't', size: 5, me: { ...me, correct: 3, total_ms: 30000 }, rival: ana, host: 'h' })
    expect(tie.texts).toContain('Empate!')
  })
})
