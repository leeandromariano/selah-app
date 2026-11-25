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
    fireEvent.change(screen.getByLabelText('Do versículo'), { target: { value: '2' } })
    expect(screen.getByText('Trecho fictício')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Usar passagem' }))
    expect(onSelect).toHaveBeenCalledWith({ translation: 'nvt', book: 'genesis', chapter: 1, verse: 2, endVerse: 3, reference: 'Gênesis 1:2-3' })
    expect(report).toHaveBeenCalledWith('ficticio')
  })
  const chapter = { verses: [1, 2, 3, 4, 5].map(number => ({ number, text: 'Versículo fictício ' + number })), copyright: 'Atribuição fictícia', fumsToken: 'ficticio' }
  it('seleciona uma faixa de vários versículos e mostra o texto numerado antes de confirmar', async () => {
    const onSelect = vi.fn()
    render(<BiblePassagePicker onSelect={onSelect} load={vi.fn().mockResolvedValue(chapter)} report={vi.fn().mockResolvedValue(undefined)} />)
    await screen.findByText('Versículo fictício 1')
    fireEvent.change(screen.getByLabelText('Do versículo'), { target: { value: '2' } })
    expect(screen.getByLabelText('Até o versículo')).toHaveValue('2')
    expect(Array.from((screen.getByLabelText('Até o versículo') as HTMLSelectElement).options).map(o => o.value)).toEqual(['2', '3', '4', '5'])
    fireEvent.change(screen.getByLabelText('Até o versículo'), { target: { value: '4' } })
    const preview = screen.getByLabelText('Texto da passagem escolhida')
    expect(preview).toHaveTextContent('2 Versículo fictício 2')
    expect(preview).toHaveTextContent('4 Versículo fictício 4')
    expect(preview).not.toHaveTextContent('Versículo fictício 5')
    fireEvent.click(screen.getByRole('button', { name: 'Usar passagem' }))
    expect(onSelect).toHaveBeenCalledWith({ translation: 'nvt', book: 'genesis', chapter: 1, verse: 2, endVerse: 4, reference: 'Gênesis 1:2-4' })
  })
  it('permite usar o capítulo inteiro, com a referência sem versículos', async () => {
    const onSelect = vi.fn()
    render(<BiblePassagePicker onSelect={onSelect} load={vi.fn().mockResolvedValue(chapter)} report={vi.fn().mockResolvedValue(undefined)} />)
    await screen.findByText('Versículo fictício 1')
    fireEvent.click(screen.getByLabelText('Usar o capítulo inteiro'))
    expect(screen.getByLabelText('Usar o capítulo inteiro')).toBeChecked()
    expect(screen.getByLabelText('Texto da passagem escolhida')).toHaveTextContent('5 Versículo fictício 5')
    fireEvent.click(screen.getByRole('button', { name: 'Usar passagem' }))
    expect(onSelect).toHaveBeenCalledWith({ translation: 'nvt', book: 'genesis', chapter: 1, verse: 1, endVerse: 5, reference: 'Gênesis 1' })
    fireEvent.click(screen.getByLabelText('Usar o capítulo inteiro'))
    expect(screen.getByLabelText('Usar o capítulo inteiro')).not.toBeChecked()
    expect(screen.getByLabelText('Até o versículo')).toHaveValue('1')
  })
  it('trocar o versículo inicial reinicia o final para o mesmo versículo', async () => {
    render(<BiblePassagePicker onSelect={vi.fn()} load={vi.fn().mockResolvedValue(chapter)} report={vi.fn().mockResolvedValue(undefined)} />)
    await screen.findByText('Versículo fictício 1')
    fireEvent.change(screen.getByLabelText('Até o versículo'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Do versículo'), { target: { value: '3' } })
    expect(screen.getByLabelText('Até o versículo')).toHaveValue('3')
  })
  it('não permite selecionar quando a consulta falha', async () => {
    render(<BiblePassagePicker onSelect={vi.fn()} load={vi.fn().mockRejectedValue(Error('falha'))} report={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível')
    expect(screen.queryByRole('button', { name: 'Usar passagem' })).not.toBeInTheDocument()
  })
})
