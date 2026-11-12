import { describe, expect, it } from 'vitest'
import { locateBlanks, normalizeWord, shareText, splitToken, tokenize } from './mask'

// Texto fictício, só para testar a mecânica (não é texto bíblico).
const tokens = tokenize('Alfa beta, gama delta; épsilon zeta eta teta.')

describe('máscara do versículo oculto', () => {
  it('normaliza sem acentos, pontuação e maiúsculas, como o servidor', () => {
    expect(normalizeWord('Unigênito,')).toBe('unigenito')
    expect(normalizeWord('Coração!')).toBe('coracao')
  })
  it('separa pontuação do começo e do fim da palavra', () => {
    expect(splitToken('“pastor;”')).toEqual({ before: '“', core: 'pastor', after: ';”' })
    expect(splitToken('amor.')).toEqual({ before: '', core: 'amor', after: '.' })
  })
  it('localiza as palavras pela posição, conferindo tamanho e palavra anterior', () => {
    expect(locateBlanks(tokens, [{ index: 2, length: 4, prev: 'alfa' }, { index: 5, length: 7, prev: 'delta' }])).toEqual([1, 4])
    expect(locateBlanks(tokens, [{ index: 1, length: 4, prev: '' }])).toEqual([0])
  })
  it('acha a posição mais próxima se o texto tiver uma palavra a mais ou a menos', () => {
    const shifted = tokenize('Extra alfa beta, gama delta;')
    expect(locateBlanks(shifted, [{ index: 2, length: 4, prev: 'alfa' }])).toEqual([2])
  })
  it('recusa quando nada confere ou quando duas lacunas caem no mesmo lugar', () => {
    expect(locateBlanks(tokens, [{ index: 2, length: 9, prev: 'alfa' }])).toBeNull()
    expect(locateBlanks(tokens, [{ index: 2, length: 4, prev: 'zzz' }])).toBeNull()
    expect(locateBlanks(tokens, [{ index: 2, length: 4, prev: 'alfa' }, { index: 2, length: 4, prev: 'alfa' }])).toBeNull()
  })
  it('gera a grade de compartilhamento só com quadrados, sem spoiler', () => {
    const text = shareText(7, [[true, false, true], [true, true, true]], true, 4, 'https://exemplo.test/#bereia/versiculo')
    expect(text).toBe('Versículo Oculto #7 2/4\n\n🟧⬛🟧\n🟧🟧🟧\n\nhttps://exemplo.test/#bereia/versiculo')
    expect(shareText(7, [[false, false]], false, 4, 'u')).toContain('#7 X/4')
  })
})
