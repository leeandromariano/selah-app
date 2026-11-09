import { describe, expect, it, vi } from 'vitest'
import { cardDimensions, drawDevotionalCard } from './shareCard'

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
    expect(fillText.mock.calls.filter(call => call[1] === 350 && call[0] !== 'ACESSE O APP:').map(call => call[0]).join('')).toBe('https://coram.example/#leitura/fiction')
    expect(fillText.mock.calls.some(call => String(call[0]).includes('esperança floresce'))).toBe(true)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 1920)
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
