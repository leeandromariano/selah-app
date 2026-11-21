import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PrayerCapsuleForm } from './PrayerCapsuleForm'

const id = '11111111-1111-4111-8111-111111111111'
const item = { id, request: 'Pedido fictício', created_on: '2026-11-13', review_on: '2026-12-13', status: 'open', answered_on: null, testimony: null, days_since: 0 }

describe('Cápsula de oração (formulário)', () => {
  it('guarda o pedido com 30 dias por padrão e avisa a data do retorno', async () => {
    const repo = { create: vi.fn().mockResolvedValue(item) }
    render(<PrayerCapsuleForm devotionalId={id} repo={repo as never} />)
    const user = userEvent.setup()
    expect(screen.getByLabelText('Rever este pedido')).toHaveValue('30')
    await user.type(screen.getByLabelText('Meu pedido de oração'), 'Pedido fictício')
    await user.click(screen.getByRole('button', { name: 'Guardar no secreto' }))
    expect(repo.create).toHaveBeenCalledWith('Pedido fictício', 30, id)
    expect(await screen.findByRole('status')).toHaveTextContent('13/12/2026')
    expect(screen.getByRole('link', { name: /Ver meus pedidos/ })).toHaveAttribute('href', '#minha-jornada')
    await user.click(screen.getByRole('button', { name: 'Guardar outro pedido' }))
    expect(screen.getByLabelText('Meu pedido de oração')).toHaveValue('')
  })
  it('permite escolher outro prazo, como 3 meses', async () => {
    const repo = { create: vi.fn().mockResolvedValue(item) }
    render(<PrayerCapsuleForm repo={repo as never} />)
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Rever este pedido'), 'Daqui a 3 meses')
    await user.type(screen.getByLabelText('Meu pedido de oração'), 'Outro pedido')
    await user.click(screen.getByRole('button', { name: 'Guardar no secreto' }))
    expect(repo.create).toHaveBeenCalledWith('Outro pedido', 90, null)
  })
  it('não envia pedido vazio e mostra erro de conexão mantendo o texto', async () => {
    const repo = { create: vi.fn().mockRejectedValue(Error('offline')) }
    render(<PrayerCapsuleForm repo={repo as never} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Guardar no secreto' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Escreva o seu pedido')
    expect(repo.create).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Meu pedido de oração'), 'Meu pedido')
    await user.click(screen.getByRole('button', { name: 'Guardar no secreto' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível guardar agora')
    expect(screen.getByLabelText('Meu pedido de oração')).toHaveValue('Meu pedido')
  })
})
