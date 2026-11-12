import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PrayerMural } from './PrayerMural'

const open = { id: '11111111-1111-4111-8111-111111111111', request: 'Pedido ainda aberto', created_on: '2026-11-01', review_on: '2026-12-01', status: 'open', answered_on: null, testimony: null, days_since: 5 }
const answered = { id: '22222222-2222-4222-8222-222222222222', request: 'Pedido já respondido', created_on: '2026-09-01', review_on: '2026-10-01', status: 'answered', answered_on: '2026-10-05', testimony: 'Deus abriu a porta', days_since: 70 }
function repo(overrides: Record<string, unknown> = {}) {
  return {
    list: vi.fn(async (status: string) => ({ status, total: 1, page: 0, size: 20, items: [status === 'answered' ? answered : open] })),
    answer: vi.fn().mockResolvedValue(answered), remove: vi.fn().mockResolvedValue(undefined), ...overrides,
  }
}

describe('Mural de testemunhos', () => {
  it('mostra os testemunhos e os pedidos em oração, com as datas', async () => {
    render(<PrayerMural repo={repo() as never} />)
    expect(await screen.findByText('Pedido já respondido')).toBeVisible()
    expect(screen.getByText(/Deus abriu a porta/)).toBeVisible()
    expect(screen.getByText(/Respondida em 05\/10\/2026 · pedido de 01\/09\/2026/)).toBeVisible()
    expect(screen.getByText('Pedido ainda aberto')).toBeVisible()
    expect(screen.getByText(/revisão em 01\/12\/2026/)).toBeVisible()
  })
  it('mostra mensagens de vazio acolhedoras', async () => {
    render(<PrayerMural repo={repo({ list: vi.fn(async (status: string) => ({ status, total: 0, page: 0, size: 20, items: [] })) }) as never} />)
    expect(await screen.findByText(/Quando Deus responder um pedido/)).toBeVisible()
    expect(screen.getByText(/Nenhum pedido guardado ainda/)).toBeVisible()
  })
  it('marca um pedido em oração como respondido, com testemunho', async () => {
    const r = repo()
    render(<PrayerMural repo={r as never} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Marcar como respondido: Pedido ainda aberto/ }))
    await user.type(screen.getByLabelText(/Conte como Deus agiu/), 'Foi curado')
    await user.click(screen.getByRole('button', { name: 'Guardar no mural' }))
    expect(r.answer).toHaveBeenCalledWith(open.id, 'Foi curado')
  })
  it('pede confirmação antes de excluir', async () => {
    const r = repo()
    render(<PrayerMural repo={r as never} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Excluir: Pedido ainda aberto/ }))
    expect(within(screen.getByRole('alert')).getByText(/Excluir este pedido para sempre/)).toBeVisible()
    expect(r.remove).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Sim, excluir' }))
    expect(r.remove).toHaveBeenCalledWith(open.id)
  })
  it('mostra erro e permite tentar de novo', async () => {
    const list = vi.fn().mockRejectedValue(Error('x'))
    render(<PrayerMural repo={{ list } as never} />)
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('Não foi possível carregar agora')
  })
})
