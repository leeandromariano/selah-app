import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BiblePassagePicker } from './BiblePassagePicker'

describe('seleção de passagem bíblica', () => {
  it('escolhe trecho agrupado com tradução e referência sem copiar o texto para o resultado', async () => {
    const onSelect = vi.fn()
    const load = vi.fn().mockResolvedValue({ verses: [{ number: 1, text: 'Texto fictício' }, { number: 2, endNumber: 3, text: 'Trecho fictício' }], copyright: 'Atribuição fictícia', fumsToken: 'ficticio' })
    const report = vi.fn().mockResolvedValue(undefined)
    render(<BiblePassagePicker onSelect={onSelect} load={load} report={report} />)
    await screen.findByText('Texto fictício')
    fireEvent.change(screen.getByLabelText('Versículo'), { target: { value: '2' } })
    expect(screen.getByText('Trecho fictício')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Usar passagem' }))
    expect(onSelect).toHaveBeenCalledWith({ translation: 'nvt', book: 'genesis', chapter: 1, verse: 2, endVerse: 3, reference: 'Gênesis 1:2-3' })
    expect(report).toHaveBeenCalledWith('ficticio')
  })
  it('não permite selecionar quando a consulta falha', async () => {
    render(<BiblePassagePicker onSelect={vi.fn()} load={vi.fn().mockRejectedValue(Error('falha'))} report={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível')
    expect(screen.queryByRole('button', { name: 'Usar passagem' })).not.toBeInTheDocument()
  })
})
