import { describe, expect, it } from 'vitest'
import { parseImport } from './import'

const good = { term: 'Aliança', words: ['aliança', 'alianças'], original: 'Do hebraico berit (fictício).', context: 'Contexto fictício.', parallel_reference: 'Hebreus 8:10', verses: ['Gênesis 15:18', 'Êxodo 24:8-9'] }

describe('Raio-X: importação em lote', () => {
  it('converte termos válidos para o formato do servidor, sempre como rascunho', () => {
    const { rows, error } = parseImport(JSON.stringify([{ ...good, status: 'published' }]))
    expect(error).toBeUndefined()
    expect(rows[0].problems).toEqual([])
    expect(rows[0].input).toEqual({
      id: null, term: 'Aliança', words: ['aliança', 'alianças'], original: 'Do hebraico berit (fictício).', context: 'Contexto fictício.', parallel_reference: 'Hebreus 8:10', status: 'draft',
      verses: [{ book: 'genesis', chapter: 15, start: 18, end: 18 }, { book: 'exodo', chapter: 24, start: 8, end: 9 }],
    })
  })
  it('aceita palavras e versículos em texto corrido e a lista dentro de "terms"', () => {
    const { rows } = parseImport(JSON.stringify({ terms: [{ ...good, words: 'aliança, alianças', verses: 'Gênesis 15:18; Êxodo 24:8' }] }))
    expect(rows[0].input?.words).toEqual(['aliança', 'alianças'])
    expect(rows[0].input?.verses).toHaveLength(2)
  })
  it('aponta o problema de cada termo sem barrar os válidos', () => {
    const { rows } = parseImport(JSON.stringify([good, { ...good, term: 'Ruim', verses: ['Livro Inexistente 1:1'] }, { ...good, term: 'Longo', original: 'x'.repeat(301) }, { ...good, term: 'Sem palavras', words: [] }, 'texto solto']))
    expect(rows.map(row => !!row.input)).toEqual([true, false, false, false, false])
    expect(rows[1].problems[0]).toContain('versículo inválido: "Livro Inexistente 1:1"')
    expect(rows[2].problems[0]).toContain('300')
    expect(rows[3].problems[0]).toContain('palavras')
    expect(rows[4].problems).toEqual(['não é um termo'])
  })
  it('recusa nome repetido no arquivo e arquivo que não é uma lista de termos', () => {
    const { rows } = parseImport(JSON.stringify([good, { ...good, term: 'aliança' }]))
    expect(rows[1].problems).toContain('nome repetido no arquivo')
    expect(parseImport('não é json').error).toBe('O arquivo não é um JSON válido.')
    expect(parseImport('{"x":1}').error).toBe('Esperava uma lista de termos.')
    expect(parseImport('[]').error).toBe('A lista está vazia.')
  })
})
