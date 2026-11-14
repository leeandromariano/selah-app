import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuizVerse } from './QuizVerse'

const chapter = { verses: [{ number: 1, text: 'Primeiro texto fictício.' }, { number: 2, text: 'Segundo texto fictício.' }, { number: 3, text: 'Terceiro texto fictício.' }], copyright: 'Texto fictício de teste.', fumsToken: 'token' }

describe('Versículo no quiz', () => {
  it('mostra o texto completo do versículo em ARA, registra a exibição e cita a fonte', async () => {
    const load = vi.fn().mockResolvedValue(chapter), report = vi.fn().mockResolvedValue(undefined)
    render(<QuizVerse reference="João 3:2" load={load} report={report} />)
    expect(await screen.findByText('Segundo texto fictício.')).toBeVisible()
    expect(screen.queryByText('Primeiro texto fictício.')).not.toBeInTheDocument()
    expect(load).toHaveBeenCalledWith({ translation: 'ara', book: 'joao', chapter: 3 })
    expect(report).toHaveBeenCalledWith('token')
    expect(screen.getByText('João 3:2 · ARA')).toBeVisible()
    expect(screen.getByText('Texto fictício de teste.')).toBeVisible()
  })
  it('mostra os versículos de um intervalo, com numeração', async () => {
    render(<QuizVerse reference="João 3:1-2" load={vi.fn().mockResolvedValue(chapter)} report={vi.fn().mockResolvedValue(undefined)} />)
    expect(await screen.findByText('Primeiro texto fictício.')).toBeVisible()
    expect(screen.getByText('Segundo texto fictício.')).toBeVisible()
    expect(screen.queryByText('Terceiro texto fictício.')).not.toBeInTheDocument()
  })
  it('não mostra nada (nem erro) quando a Bíblia está indisponível ou a referência não tem versículo', async () => {
    const load = vi.fn().mockRejectedValue(Error('offline'))
    const { container, rerender } = render(<QuizVerse reference="João 3:2" load={load} report={vi.fn()} />)
    await vi.waitFor(() => expect(load).toHaveBeenCalled())
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement())
    const other = vi.fn()
    rerender(<QuizVerse reference="Obadias 1" load={other} report={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
    expect(other).not.toHaveBeenCalled()
  })
})
