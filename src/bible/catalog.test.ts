import { describe, expect, it } from 'vitest'
import { adjacent, bibleHash, books, parseBibleRoute, parseReference } from './catalog'
import { demoProvider, licensedReferenceLink } from './provider'

describe('catálogo e referências bíblicas', () => {
  it('lista os 66 livros protestantes em ordem com seus capítulos', () => {
    expect(books).toHaveLength(66)
    expect(books.filter(b => b.testament === 'Antigo Testamento')).toHaveLength(39)
    expect(books.map(b => b.chapters)).toEqual([50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22])
    expect(new Set(books.map(b => b.id)).size).toBe(66)
  })
  it('atravessa livros e para nos extremos', () => {
    expect(adjacent('genesis', 1, -1)).toBeNull()
    expect(adjacent('genesis', 50, 1)).toEqual({ book: 'exodo', chapter: 1 })
    expect(adjacent('exodo', 1, -1)).toEqual({ book: 'genesis', chapter: 50 })
    expect(adjacent('apocalipse', 22, 1)).toBeNull()
    expect(adjacent('joao', 22, 1)).toBeNull()
  })
  it('interpreta apenas referências completas e inequívocas', () => {
    expect(parseReference('João 3:16')).toEqual({ book: 'joao', chapter: 3, verse: 16, endVerse: undefined })
    expect(parseReference('João 3 16')).toEqual({ book: 'joao', chapter: 3, verse: 16, endVerse: undefined })
    expect(parseReference('1 João 3 16')).toEqual({ book: '1-joao', chapter: 3, verse: 16, endVerse: undefined })
    expect(parseReference('Romanos 12:1-2')).toEqual({ book: 'romanos', chapter: 12, verse: 1, endVerse: 2 })
    expect(parseReference('Salmos 23')?.chapter).toBe(23)
    for (const reference of ['Jo 3:16','João 22:1','João 3:0','João 3:4-2','João 3:16; 4:1','<script> 1:1']) expect(parseReference(reference)).toBeNull()
  })
  it('rejeita rotas inseguras e não gera links fictícios', () => {
    expect(parseBibleRoute('biblia/demonstracao/joao/3/16-17')).toEqual({ translation: 'demonstracao', book: 'joao', chapter: 3, verse: 16, endVerse: 17 })
    for (const route of ['biblia/https://evil/joao/3','biblia/demo/joao/0','biblia/demo/joao/3/2-1','biblia/demo/joao/3/1?x=1','biblia/demo/../3']) expect(parseBibleRoute(route)).toBeNull()
    expect(licensedReferenceLink('João 3:16', demoProvider, parseReference)).toBeNull()
    const licensed = { ...demoProvider, translations: [{ ...demoProvider.translations[0], licensedText: true }], supportsReference: () => true }
    const target = licensedReferenceLink('Romanos 12:1-2', licensed, parseReference)
    expect(target).toBeNull() // provider does not claim Romans
    expect(bibleHash(licensedReferenceLink('João 3:16', licensed, parseReference)!)).toBe('#biblia/demonstracao/joao/3/16')
  })
})
