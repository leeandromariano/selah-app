import { describe, expect, it } from 'vitest'
import { parsePanoramaImport, resolveBook } from './panoramaImport'

const good = { book: 'Romanos', author: 'Paulo', audience: 'Cristãos em Roma', context: 'Carta escrita por volta de 57 d.C.', theme: 'A justiça de Deus pela fé' }

describe('Panorama dos livros: importação', () => {
  it('reconhece o livro pelo nome do app (com ou sem acento, em qualquer caixa) ou pelo identificador', () => {
    expect(resolveBook('Romanos')).toBe('romanos')
    expect(resolveBook('1 coríntios')).toBe('1-corintios')
    expect(resolveBook('1 CORINTIOS')).toBe('1-corintios')
    expect(resolveBook('joao')).toBe('joao')
    expect(resolveBook('Cânticos')).toBeNull()
  })
  it('converte panoramas válidos para o formato do servidor, sempre como rascunho', () => {
    const { rows, error } = parsePanoramaImport(JSON.stringify([{ ...good, status: 'published' }]))
    expect(error).toBeUndefined()
    expect(rows[0].problems).toEqual([])
    expect(rows[0].input).toEqual({ book: 'romanos', author: 'Paulo', audience: 'Cristãos em Roma', context: 'Carta escrita por volta de 57 d.C.', theme: 'A justiça de Deus pela fé', status: 'draft' })
    expect(parsePanoramaImport(JSON.stringify({ panoramas: [good] })).rows[0].input?.book).toBe('romanos')
  })
  it('aponta o problema de cada item sem barrar os válidos', () => {
    const { rows } = parsePanoramaImport(JSON.stringify([
      good, { ...good, book: 'Livro Inexistente' }, { ...good, book: 'Levítico', author: '' }, { ...good, book: 'Apocalipse', context: 'x'.repeat(301) }, 'solto',
    ]))
    expect(rows.map(row => !!row.input)).toEqual([true, false, false, false, false])
    expect(rows[1].problems[0]).toContain('livro desconhecido: "Livro Inexistente"')
    expect(rows[2].problems).toContain('autor vazio')
    expect(rows[3].problems[0]).toContain('300')
    expect(rows[4].problems).toEqual(['não é um panorama'])
  })
  it('recusa livro repetido no arquivo e arquivo que não é uma lista de panoramas', () => {
    const { rows } = parsePanoramaImport(JSON.stringify([good, { ...good, book: 'romanos' }]))
    expect(rows[1].problems).toContain('livro repetido no arquivo')
    expect(parsePanoramaImport('não é json').error).toBe('O arquivo não é um JSON válido.')
    expect(parsePanoramaImport('{"x":1}').error).toBe('Esperava uma lista de panoramas.')
    expect(parsePanoramaImport('[]').error).toBe('A lista está vazia.')
  })
})
