import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { AccountPrivacy } from './AccountPrivacy'
function boundary(data: unknown = null, error: unknown = null) {
  const q = { select: vi.fn(), eq: vi.fn(), insert: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error }), single: vi.fn().mockResolvedValue({ data: { user_id: 'reader', requested_at: '2026-10-26T12:00:00Z' }, error: null }) }
  for (const method of ['select', 'eq', 'insert'] as const) q[method].mockReturnValue(q)
  vi.mocked(supabase.from).mockReturnValue(q as never)
  return q
}
describe('privacidade e solicitação da própria conta', () => {
  it('bloqueia envio repetido e descarta resultado de conta anterior após desmontar', async () => {
    const q = boundary()
    let finish!: (value: never) => void
    q.single.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const user = userEvent.setup()
    const view = render(<AccountPrivacy userId="reader" />)
    await user.click(screen.getByRole('button', { name: 'Solicitar exclusão da conta' }))
    await user.click(await screen.findByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Confirmar solicitação' }))
    const pending = screen.getByRole('button', { name: 'Registrando…' })
    expect(pending).toBeDisabled()
    await user.click(pending)
    expect(q.insert).toHaveBeenCalledTimes(1)
    view.unmount()
    render(<AccountPrivacy userId="other" />)
    await act(async () => { finish({ data: { user_id: 'reader', requested_at: '2026-10-26T12:00:00Z' }, error: null } as never) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Solicitar exclusão da conta' })).toHaveAttribute('aria-expanded', 'false')
  })
  it('não consulta até abrir; exige confirmação e conserva pedido ao remontar', async () => {
    const q = boundary()
    const user = userEvent.setup()
    const view = render(<AccountPrivacy userId="reader" />)
    expect(supabase.from).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Solicitar exclusão da conta' }))
    const button = await screen.findByRole('button', { name: 'Confirmar solicitação' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(q.insert).not.toHaveBeenCalled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(button)
    expect(await screen.findByRole('status')).toHaveTextContent('Nenhum dado foi apagado')
    expect(q.insert).toHaveBeenCalledExactlyOnceWith({ user_id: 'reader' })
    q.maybeSingle.mockResolvedValue({ data: { user_id: 'reader', requested_at: '2026-10-26T12:00:00Z' }, error: null })
    view.unmount()
    render(<AccountPrivacy userId="reader" />)
    await user.click(screen.getByRole('button', { name: 'Solicitar exclusão da conta' }))
    expect(await screen.findByRole('status')).toHaveTextContent('pedido de exclusão está registrado')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
  it('falha ao consultar não permite pedido e não expõe diagnóstico privado', async () => {
    const q = boundary(null, { code: '42501', message: 'other@example.invalid secret' })
    const user = userEvent.setup()
    render(<AccountPrivacy userId="reader" />)
    await user.click(screen.getByRole('button', { name: 'Solicitar exclusão da conta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique sua sessão')
    expect(screen.queryByText(/other@example/)).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(q.insert).not.toHaveBeenCalled()
    q.maybeSingle.mockResolvedValue({ data: null, error: null })
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('checkbox')).not.toBeChecked()
  })
  it('negação de gravação mantém confirmação sem anunciar sucesso', async () => {
    const q = boundary()
    q.single.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'private account' } })
    const user = userEvent.setup()
    render(<AccountPrivacy userId="reader" />)
    await user.click(screen.getByRole('button', { name: 'Solicitar exclusão da conta' }))
    await user.click(await screen.findByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Confirmar solicitação' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('private account')).not.toBeInTheDocument()
  })
})
