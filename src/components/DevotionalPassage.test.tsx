import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DevotionalPassage } from './DevotionalPassage'

vi.mock('../bible/apiClient', () => ({ fetchApiChapter: vi.fn().mockResolvedValue({ verses: [{ number: 9, endNumber: 10, text: 'Passagem fictícia' }], copyright: 'Atribuição fictícia', fumsToken: 'ficticio' }) }))
vi.mock('../bible/fums', () => ({ reportBibleView: vi.fn().mockResolvedValue(undefined) }))

describe('passagem do devocional', () => {
  it('abre a referência exata ao clicar duas vezes e também oferece link acessível', async () => {
    const selection = { translation: 'ntlh', book: 'esdras', chapter: 1, verse: 9, endVerse: 10 }
    render(<DevotionalPassage reference="Esdras 1:9-10" selection={selection} />)
    const text = await screen.findByText('Passagem fictícia')
    expect(screen.getByText('Atribuição fictícia')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Abrir na Bíblia' })).toHaveAttribute('href', '#biblia/ntlh/esdras/1/9-10')
    fireEvent.doubleClick(text)
    expect(location.hash).toBe('#biblia/ntlh/esdras/1/9-10')
  })
})
