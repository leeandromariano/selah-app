import { describe, expect, it } from 'vitest'
import { splitByTerms, termsForVerse } from './mark'
import type { StudyTerm } from './repository'

const grace: StudyTerm = { id: 'g', term: 'Graça', words: ['graça', 'graças'], original: 'o', context: 'c', parallel_reference: 'Romanos 11:6', verses: [{ start: 8, end: 8 }] }
const faith: StudyTerm = { id: 'f', term: 'Fé', words: ['fé'], original: 'o', context: 'c', parallel_reference: 'Hebreus 11:6', verses: [{ start: 8, end: 9 }] }

describe('Raio-X: marcação dos termos', () => {
  it('só vale nos versículos ligados ao termo, inclusive em faixas', () => {
    expect(termsForVerse([grace, faith], 7)).toEqual([])
    expect(termsForVerse([grace, faith], 8).map(t => t.term)).toEqual(['Graça', 'Fé'])
    expect(termsForVerse([grace, faith], 9).map(t => t.term)).toEqual(['Fé'])
    expect(termsForVerse([grace, faith], 6, 8).map(t => t.term)).toEqual(['Graça', 'Fé'])
  })
  it('marca palavra inteira, sem diferenciar maiúsculas, e só a primeira ocorrência de cada termo', () => {
    const pieces = splitByTerms('Pela Graça somos salvos, e a graça basta; sem café nem fé morta.', [grace, faith])
    expect(pieces.map(p => p.text).join('')).toBe('Pela Graça somos salvos, e a graça basta; sem café nem fé morta.')
    expect(pieces.filter(p => p.term).map(p => `${p.term!.term}:${p.text}`)).toEqual(['Graça:Graça', 'Fé:fé'])
  })
  it('sem termos ou sem ocorrência devolve o texto inteiro', () => {
    expect(splitByTerms('Texto simples.', [])).toEqual([{ text: 'Texto simples.' }])
    expect(splitByTerms('Texto simples.', [grace])).toEqual([{ text: 'Texto simples.' }])
  })
  it('palavras com caracteres especiais não quebram a busca', () => {
    const dot: StudyTerm = { ...grace, id: 'd', words: ['a.b'] }, paren: StudyTerm = { ...grace, id: 'p', words: ['(x)'] }
    expect(splitByTerms('a.b e (x), mas axb não', [dot, paren]).filter(p => p.term).map(p => p.text)).toEqual(['a.b', '(x)'])
  })
})
