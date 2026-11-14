import { describe, expect, it } from 'vitest'
import { parseApiChapter } from './apiChapter'

const sample = () => ({ data: { copyright: 'Atribuição fictícia', content: [{ type: 'tag', name: 'para', items: [
  { type: 'tag', name: 'verse', attrs: { number: '1' }, items: [{ type: 'text', text: '1' }] },
  { type: 'text', text: 'Primeira frase fictícia. ' },
  { type: 'tag', name: 'char', items: [{ type: 'text', text: 'Continuação.' }] },
  { type: 'tag', name: 'verse', attrs: { number: '2' }, items: [{ type: 'text', text: '2' }] },
  { type: 'text', text: 'Segunda frase fictícia.' },
] }] }, meta: { fumsToken: 'token-ficticio' } })

describe('capítulo recebido da API', () => {
  it('preserva o texto, a atribuição e o identificador de uso', () => {
    expect(parseApiChapter(sample())).toEqual({ verses: [{ number: 1, text: 'Primeira frase fictícia. Continuação.' }, { number: 2, text: 'Segunda frase fictícia.' }], copyright: 'Atribuição fictícia', fumsToken: 'token-ficticio' })
  })
  it('recusa resposta sem atribuição ou token', () => {
    const chapter = sample()
    chapter.meta.fumsToken = ''
    expect(() => parseApiChapter(chapter)).toThrow()
    chapter.meta.fumsToken = 'token-ficticio'
    chapter.data.copyright = ''
    expect(() => parseApiChapter(chapter)).toThrow()
  })
  it('recusa numeração ambígua e conteúdo desconhecido', () => {
    const chapter = sample()
    chapter.data.content[0].items[3].attrs!.number = '1'
    expect(() => parseApiChapter(chapter)).toThrow()
    chapter.data.content[0].items[3].attrs!.number = '2'
    chapter.data.content[0].items[1].type = 'unexpected'
    expect(() => parseApiChapter(chapter)).toThrow()
  })
  it('não descarta conteúdo inesperado dentro de um marcador', () => {
    const chapter = sample()
    chapter.data.content[0].items[0].items![0].text = 'Texto não esperado'
    expect(() => parseApiChapter(chapter)).toThrow()
  })
  it('preserva marcadores de versículos agrupados', () => {
    const chapter = sample()
    chapter.data.content[0].items[3].attrs!.number = '2-3'
    chapter.data.content[0].items[3].items![0].text = '2-3'
    expect(parseApiChapter(chapter).verses[1]).toEqual({ number: 2, endNumber: 3, text: 'Segunda frase fictícia.' })
  })
})
