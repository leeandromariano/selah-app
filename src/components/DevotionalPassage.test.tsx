import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchApiChapter } from '../bible/apiClient'
import { DevotionalPassage } from './DevotionalPassage'

vi.mock('../bible/apiClient', () => ({ fetchApiChapter: vi.fn().mockResolvedValue({ verses: [{ number: 9, endNumber: 10, text: 'Passagem fictícia' }], copyright: 'Atribuição fictícia', fumsToken: 'ficticio' }) }))
vi.mock('../bible/fums', () => ({ reportBibleView: vi.fn().mockResolvedValue(undefined) }))

describe('passagem do devocional', () => {
  beforeEach(() => vi.clearAllMocks())

  it('abre a referência exata ao clicar duas vezes e também oferece link acessível', async () => {
    const selection = { translation: 'ntlh', book: 'esdras', chapter: 1, verse: 9, endVerse: 10 }
    render(<DevotionalPassage reference="Esdras 1:9-10" selection={selection} />)
    const text = await screen.findByText('Passagem fictícia')
    expect(screen.getByText('Atribuição fictícia')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Abrir na Bíblia' })).toHaveAttribute('href', '#biblia/ntlh/esdras/1/9-10')
    fireEvent.doubleClick(text)
    expect(location.hash).toBe('#biblia/ntlh/esdras/1/9-10')
  })

  it('mostra uma passagem com vários versículos, com os números, e até o capítulo inteiro', async () => {
    const verses = [1, 2, 3, 4].map(number => ({ number, text: 'Versículo fictício ' + number }))
    vi.mocked(fetchApiChapter).mockResolvedValueOnce({ verses, copyright: 'Atribuição fictícia', fumsToken: 'ficticio' })
    const { container, unmount } = render(<DevotionalPassage reference="Esdras 1:2-3" selection={{ translation: 'ntlh', book: 'esdras', chapter: 1, verse: 2, endVerse: 3 }} />)
    await screen.findByRole('link', { name: 'Abrir na Bíblia' })
    const quote = container.querySelector('blockquote')!
    expect(quote).toHaveTextContent('2 Versículo fictício 2')
    expect(quote).toHaveTextContent('3 Versículo fictício 3')
    expect(quote).not.toHaveTextContent('Versículo fictício 1')
    expect(quote).not.toHaveTextContent('Versículo fictício 4')
    unmount()
    vi.mocked(fetchApiChapter).mockResolvedValueOnce({ verses, copyright: 'Atribuição fictícia', fumsToken: 'ficticio' })
    const whole = render(<DevotionalPassage reference="Esdras 1" selection={{ translation: 'ntlh', book: 'esdras', chapter: 1, verse: 1, endVerse: 4 }} />)
    await screen.findByRole('link', { name: 'Abrir na Bíblia' })
    expect(whole.container.querySelector('blockquote')).toHaveTextContent('4 Versículo fictício 4')
  })
  it('avisa quando a faixa escolhida não existe no capítulo carregado', async () => {
    vi.mocked(fetchApiChapter).mockResolvedValueOnce({ verses: [1, 2].map(number => ({ number, text: 'Versículo ' + number })), copyright: 'x', fumsToken: 'f' })
    render(<DevotionalPassage reference="Esdras 1:1-9" selection={{ translation: 'ntlh', book: 'esdras', chapter: 1, verse: 1, endVerse: 9 }} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar a passagem bíblica')
  })
  it('permite ler o capítulo inteiro na etapa sem navegar nem fazer uma segunda chamada à API', async () => {
    vi.mocked(fetchApiChapter).mockResolvedValueOnce({
      verses: [
        { number: 8, text: 'Antes da passagem fictícia.' },
        { number: 9, endNumber: 10, text: 'Passagem fictícia agrupada.' },
        { number: 11, text: 'Depois da passagem fictícia.' },
      ],
      copyright: 'Atribuição fictícia', fumsToken: 'ficticio',
    })
    const selection = { translation: 'ntlh', book: 'esdras', chapter: 1, verse: 9, endVerse: 10 }
    render(<DevotionalPassage reference="Esdras 1:9-10" selection={selection} inlineChapter />)
    await screen.findByRole('link', { name: 'Abrir na Bíblia' })
    const hash = location.hash
    const disclosure = screen.getByText('Ler capítulo completo aqui').closest('details')!
    expect(disclosure).not.toHaveAttribute('open')
    fireEvent.click(screen.getByText('Ler capítulo completo aqui'))
    expect(disclosure).toHaveAttribute('open')
    expect(screen.getByRole('heading', { name: 'Esdras 1 · NTLH' })).toBeVisible()
    expect(screen.getByText('Antes da passagem fictícia.')).toBeVisible()
    expect(screen.getByText('Depois da passagem fictícia.')).toBeVisible()
    expect(disclosure.querySelector('p.selected')).toHaveTextContent('9–10 Passagem fictícia agrupada.')
    expect(disclosure).toHaveTextContent('Atribuição fictícia')
    expect(fetchApiChapter).toHaveBeenCalledTimes(1)
    expect(location.hash).toBe(hash)
  })
})
