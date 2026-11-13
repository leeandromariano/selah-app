import { describe, expect, it, vi } from 'vitest'
import { buildShareCaption, cardDimensions, drawDevotionalCard } from './shareCard'

function fakeCanvas() {
  const fillText = vi.fn()
  const ctx = { fillRect: vi.fn(), strokeRect: vi.fn(), fillText, measureText: vi.fn((text: string) => ({ width: text.length * 25 })) }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fillText }
}

describe('card PNG do devocional', () => {
  it('uses native post and story dimensions and paints authored invitation fields', () => {
    expect(cardDimensions.post).toEqual({ width: 1080, height: 1350 })
    expect(cardDimensions.story).toEqual({ width: 1080, height: 1920 })
    const { ctx, fillText } = fakeCanvas()
    drawDevotionalCard(ctx, { title: 'Paz para hoje', phrase: 'A esperança floresce quando fazemos uma pausa.', reference: 'João 14:27', url: 'https://coram.example/#leitura/fiction', format: 'story', theme: 'ember' })
    expect(fillText.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining(['CORAM  /  FRASE DO DEVOCIONAL', 'JOÃO 14:27', 'Paz para hoje', 'ACESSE O APP:']))
    // o link ocupa a base inteira, alinhado à esquerda, nas duas últimas linhas
    expect(fillText.mock.calls.filter(call => call[1] === 84 && call[2] >= 1920 - 76).map(call => call[0]).join('')).toBe('https://coram.example/#leitura/fiction')
    expect(fillText.mock.calls.some(call => String(call[0]).includes('esperança floresce'))).toBe(true)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 1920)
  })
  it('o link não divide altura com "mais presença." e o autor aparece logo abaixo da frase', () => {
    const { ctx, fillText } = fakeCanvas()
    drawDevotionalCard(ctx, { title: 'Off com o Pai', phrase: 'Você não continua com Deus porque é constante.', author: 'Leandro Exemplo', reference: 'Romanos 8:1-17', url: 'https://coram.example/#leitura/fiction', format: 'story', theme: 'obsidian' })
    const at = (text: string) => fillText.mock.calls.find(call => call[0] === text)!
    const phrase = 'Você não continua com Deus porque é constante.'
    const lastPhraseY = Math.max(...fillText.mock.calls.filter(call => call[1] === 84 && phrase.includes(String(call[0])) && String(call[0]).length > 3).map(call => call[2]))
    expect(at('Leandro Exemplo')[2]).toBeGreaterThan(lastPhraseY)
    expect(at('Leandro Exemplo')[2] - lastPhraseY).toBeLessThan(140)
    expect(at('Leandro Exemplo')[2]).toBeLessThan(at('MENOS ROTINA.')[2] - 60)
    // sem sobreposição: o rótulo do link fica bem abaixo da frase de marca e tudo na mesma coluna
    expect(at('ACESSE O APP:')[2] - at('mais presença.')[2]).toBeGreaterThan(60)
    expect(at('ACESSE O APP:')[1]).toBe(84)
    expect(at('CORAM')[2]).toBeGreaterThan(at('mais presença.')[2] + 30)
    expect(at('CORAM')[2]).toBeLessThan(at('ACESSE O APP:')[2] - 20)
  })
  it('sem autor não desenha linha de autor e nome muito longo é cortado em uma linha', () => {
    const { ctx, fillText } = fakeCanvas()
    drawDevotionalCard(ctx, { title: 'Paz', phrase: 'Frase curta.', reference: 'João 1:1', url: 'https://coram.example', format: 'story', theme: 'ember' })
    expect(fillText.mock.calls.some(call => call[0] === 'Leandro Exemplo')).toBe(false)
    const long = fakeCanvas()
    drawDevotionalCard(long.ctx, { title: 'Paz', phrase: 'Frase curta.', author: 'Nome Muito Longo '.repeat(8), reference: 'João 1:1', url: 'https://coram.example', format: 'story', theme: 'ember' })
    const drawn = long.fillText.mock.calls.filter(call => String(call[0]).endsWith('…'))
    expect(drawn).toHaveLength(1)
  })
  it('no Feed (4:5) a frase, o autor e o título cabem acima do rodapé, sem sobreposição', () => {
    const { ctx, fillText } = fakeCanvas()
    drawDevotionalCard(ctx, { title: 'Off com o Pai: quando bate a vontade de desistir', phrase: 'Você não continua com Deus porque é constante, mas porque Ele é Pai e você é filho.', author: 'Leandro Exemplo', reference: 'Romanos 8:1-17', url: 'https://appcoram.com.br/#leitura/76e9e97e-1d36-4c3b-b9f9-d6d39b8f2ff6', format: 'post', theme: 'obsidian' })
    const at = (text: string) => fillText.mock.calls.find(call => call[0] === text)!
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 1350)
    const y = fillText.mock.calls.map(call => call[2] as number)
    expect(Math.max(...y)).toBeLessThan(1350)
    // o autor termina antes do título (acima do rodapé) e o título antes de MENOS ROTINA.
    expect(at('Leandro Exemplo')[2]).toBeLessThan(at('MENOS ROTINA.')[2] - 100)
    expect(at('MENOS ROTINA.')[2]).toBeLessThan(at('mais presença.')[2])
    expect(at('ACESSE O APP:')[2] - at('mais presença.')[2]).toBeGreaterThan(60)
    const phraseLast = Math.max(...fillText.mock.calls.filter(call => call[1] === 84 && 'Você não continua com Deus porque é constante, mas porque Ele é Pai e você é filho.'.includes(String(call[0])) && String(call[0]).length > 3).map(call => call[2] as number))
    expect(at('Leandro Exemplo')[2]).toBeGreaterThan(phraseLast)
  })
  it('legenda do Instagram reúne frase, autor, referência e link', () => {
    expect(buildShareCaption({ title: 'Paz', phrase: ' Hoje posso descansar. ', author: ' Ana ', reference: 'João 14:27', link: 'https://coram.example' })).toBe('Hoje posso descansar.\n\nAna · João 14:27\n\nLeia no Coram: https://coram.example')
    expect(buildShareCaption({ title: 'Paz', reference: 'João 14:27', link: 'https://coram.example' })).toBe('Paz\n\nJoão 14:27\n\nLeia no Coram: https://coram.example')
  })
  it('wraps long titles and references inside the canvas width', () => {
    const { ctx, fillText } = fakeCanvas()
    drawDevotionalCard(ctx, { title: 'Uma palavra muito longa para caber em uma linha do card', reference: 'Primeira carta de João 1:1', url: 'https://coram.example', format: 'post', theme: 'paper' })
    expect(fillText.mock.calls.length).toBeGreaterThan(8)
    expect(fillText.mock.calls.some(call => String(call[0]).includes('Uma palavra muito longa para caber em uma linha do card'))).toBe(false)
  })
  it('rejects a phrase that cannot fit rather than exporting a cut-off card', () => {
    const { ctx } = fakeCanvas()
    expect(() => drawDevotionalCard(ctx, { title: 'Paz', phrase: 'Palavra '.repeat(100), reference: 'João 1:1', url: 'https://coram.example', format: 'post', theme: 'paper' })).toThrow('Frase longa demais')
  })
})
