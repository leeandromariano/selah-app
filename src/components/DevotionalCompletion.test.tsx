import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DevotionalCompletion } from './DevotionalCompletion'

const id = '20000000-0000-4000-8000-000000000001'
const done = { completed_at: '2026-11-13T15:00:00Z', completed_day: '2026-11-13' }

describe('conclusão do devocional direto, sem tempo mínimo', () => {
  it('o botão vale desde o início, sem barra de progresso nem contagem', () => {
    render(<DevotionalCompletion devotionalId={id} completedAt={null} onCompleted={vi.fn()} complete={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Conclusão do devocional' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Concluir devocional' })).toBeEnabled()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText(/A conclusão é uma escolha sua/)).toBeVisible()
  })
  it('conclui uma vez, mostra a data e avisa quem chamou', async () => {
    const complete = vi.fn().mockResolvedValue(done), onCompleted = vi.fn(), onCompletedNow = vi.fn()
    render(<DevotionalCompletion devotionalId={id} completedAt={null} onCompleted={onCompleted} onCompletedNow={onCompletedNow} complete={complete} />)
    fireEvent.click(screen.getByRole('button', { name: 'Concluir devocional' }))
    expect(await screen.findByText(/Devocional concluído em .*horário de Brasília/)).toBeVisible()
    expect(complete).toHaveBeenCalledOnce(); expect(complete.mock.calls[0][1]).toBe(id)
    expect(onCompleted).toHaveBeenCalledOnce(); expect(onCompletedNow).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Concluir devocional' })).not.toBeInTheDocument()
  })
  it('duplo toque não conclui duas vezes', async () => {
    let resolve: (value: typeof done) => void = () => {}
    const complete = vi.fn().mockReturnValue(new Promise(r => { resolve = r }))
    render(<DevotionalCompletion devotionalId={id} completedAt={null} onCompleted={vi.fn()} complete={complete} />)
    const button = screen.getByRole('button', { name: 'Concluir devocional' })
    fireEvent.click(button); fireEvent.click(screen.getByRole('button', { name: 'Salvando conclusão…' }))
    resolve(done)
    await screen.findByText(/Devocional concluído em/)
    expect(complete).toHaveBeenCalledOnce()
  })
  it('falha avisa, não conclui e deixa tentar de novo', async () => {
    const onCompleted = vi.fn()
    render(<DevotionalCompletion devotionalId={id} completedAt={null} onCompleted={onCompleted} complete={vi.fn().mockRejectedValue(Error('x'))} />)
    fireEvent.click(screen.getByRole('button', { name: 'Concluir devocional' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir agora')
    expect(onCompleted).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Concluir devocional' })).toBeEnabled())
  })
  it('devocional já concluído mostra a data e não oferece concluir nem abre o pop-up', () => {
    const onCompletedNow = vi.fn()
    render(<DevotionalCompletion devotionalId={id} completedAt="2026-10-28T15:00:00Z" onCompleted={vi.fn()} onCompletedNow={onCompletedNow} complete={vi.fn()} />)
    expect(screen.getByText(/Devocional concluído em/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Concluir devocional' })).not.toBeInTheDocument()
    expect(onCompletedNow).not.toHaveBeenCalled()
  })
  it('se a lista de conclusões chegar depois da tela, o botão some', () => {
    const view = render(<DevotionalCompletion devotionalId={id} completedAt={null} onCompleted={vi.fn()} complete={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Concluir devocional' })).toBeVisible()
    view.rerender(<DevotionalCompletion devotionalId={id} completedAt="2026-10-28T15:00:00Z" onCompleted={vi.fn()} complete={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Concluir devocional' })).not.toBeInTheDocument()
  })
})
