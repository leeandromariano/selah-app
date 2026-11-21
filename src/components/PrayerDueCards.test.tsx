import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PrayerDueCards } from './PrayerDueCards'

const id = '11111111-1111-4111-8111-111111111111'
const item = { id, request: 'Pela saúde fictícia', created_on: '2026-10-14', review_on: '2026-11-13', status: 'open', answered_on: null, testimony: null, days_since: 30 }

describe('Cápsulas de oração na Home', () => {
  it('não mostra nada quando não há pedido para rever, nem quando a consulta falha', async () => {
    const empty = { due: vi.fn().mockResolvedValue([]) }
    const { container, unmount } = render(<PrayerDueCards repo={empty as never} />)
    await vi.waitFor(() => expect(empty.due).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
    unmount()
    const failing = { due: vi.fn().mockRejectedValue(Error('x')) }
    const second = render(<PrayerDueCards repo={failing as never} />)
    await vi.waitFor(() => expect(failing.due).toHaveBeenCalled())
    expect(second.container).toBeEmptyDOMElement()
  })
  it('mostra a pergunta com os dias e o pedido', async () => {
    render(<PrayerDueCards repo={{ due: vi.fn().mockResolvedValue([item]) } as never} />)
    expect(await screen.findByRole('heading', { name: 'Você orou por isso há 30 dias. Como Deus agiu?' })).toBeVisible()
    expect(screen.getByText('Pela saúde fictícia')).toBeVisible()
  })
  it('marca como respondido com testemunho opcional e some da Home', async () => {
    const repo = { due: vi.fn().mockResolvedValue([item]), answer: vi.fn().mockResolvedValue({ ...item, status: 'answered' }), snooze: vi.fn() }
    render(<PrayerDueCards repo={repo as never} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Deus respondeu/ }))
    await user.type(screen.getByLabelText(/Conte como Deus agiu/), 'Ela melhorou')
    await user.click(screen.getByRole('button', { name: 'Guardar no mural' }))
    expect(repo.answer).toHaveBeenCalledWith(id, 'Ela melhorou')
    expect(await screen.findByRole('status')).toHaveTextContent('mural em Minha Jornada')
    expect(screen.queryByRole('heading', { name: /Como Deus agiu/ })).not.toBeInTheDocument()
  })
  it('permite responder sem escrever testemunho', async () => {
    const repo = { due: vi.fn().mockResolvedValue([item]), answer: vi.fn().mockResolvedValue({ ...item, status: 'answered' }), snooze: vi.fn() }
    render(<PrayerDueCards repo={repo as never} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Deus respondeu/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar no mural' }))
    expect(repo.answer).toHaveBeenCalledWith(id, '')
  })
  it('“Ainda aguardando” adia o lembrete por 30 dias', async () => {
    const repo = { due: vi.fn().mockResolvedValue([item]), answer: vi.fn(), snooze: vi.fn().mockResolvedValue(item) }
    render(<PrayerDueCards repo={repo as never} />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Ainda aguardando' }))
    expect(repo.snooze).toHaveBeenCalledWith(id, 30)
    expect(await screen.findByRole('status')).toHaveTextContent('lembrar de novo em 30 dias')
  })
  it('mostra erro e mantém o card se não conseguir salvar', async () => {
    const repo = { due: vi.fn().mockResolvedValue([item]), answer: vi.fn(), snooze: vi.fn().mockRejectedValue(Error('x')) }
    render(<PrayerDueCards repo={repo as never} />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Ainda aguardando' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar agora')
    expect(screen.getByRole('button', { name: 'Ainda aguardando' })).toBeEnabled()
  })
})
