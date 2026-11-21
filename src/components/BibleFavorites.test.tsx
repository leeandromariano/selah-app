import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BibleFavorites } from './BibleFavorites'
import { demoProvider } from '../bible/provider'

vi.mock('../bible/fums', () => ({ reportBibleView: vi.fn().mockResolvedValue(undefined) }))
const favorite = { user_id: 'fictional-user', translation: 'nvt', book: 'genesis', chapter: 1, verse_start: 1, verse_end: 2 }
const source = { ...demoProvider, translations: [{ ...demoProvider.translations[0], id: 'nvt' }], chapterDetails: vi.fn().mockResolvedValue({ verses: [{ number: 1, endNumber: 2, text: 'Passagem fictícia agrupada.' }], copyright: 'Atribuição fictícia', fumsToken: 'token-ficticio' }) }
describe('favoritos da Bíblia', () => {
  it('exibe texto, tradução, atribuição e link para o intervalo salvo', async () => {
    const onOpen = vi.fn()
    render(<BibleFavorites userId="fictional-user" store={{ listAllFavorites: vi.fn().mockResolvedValue([favorite]) } as never} source={source} onOpen={onOpen} />)
    expect(await screen.findByText('Passagem fictícia agrupada.')).toBeVisible()
    expect(screen.getByText('Atribuição fictícia')).toBeVisible()
    const link = screen.getByRole('link', { name: 'Gênesis 1:1–2 · NVT' })
    expect(link).toHaveAttribute('href', '#biblia/nvt/genesis/1/1-2')
    fireEvent.click(link)
    expect(onOpen).toHaveBeenCalledOnce()
  })
  it('informa lista vazia e oferece nova tentativa após erro', async () => {
    const listAllFavorites = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue([])
    render(<BibleFavorites userId="fictional-user" store={{ listAllFavorites } as never} source={source} onOpen={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText(/ainda não favoritou/)).toBeVisible()
  })
  it('limita o carregamento a cinco favoritos por página', async () => {
    const rows = Array.from({ length: 6 }, (_, index) => ({ ...favorite, chapter: index + 1 }))
    const chapterDetails = vi.fn().mockResolvedValue({ verses: [{ number: 1, endNumber: 2, text: 'Texto fictício.' }], copyright: 'Crédito fictício', fumsToken: 'token' })
    render(<BibleFavorites userId="fictional-user" store={{ listAllFavorites: vi.fn().mockResolvedValue(rows) } as never} source={{ ...source, chapterDetails }} onOpen={vi.fn()} />)
    await screen.findByRole('link', { name: 'Gênesis 5:1–2 · NVT' })
    expect(screen.queryByRole('link', { name: 'Gênesis 6:1–2 · NVT' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Próximos' }))
    expect(await screen.findByRole('link', { name: 'Gênesis 6:1–2 · NVT' })).toBeVisible()
  })
})
