import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthForm } from './AuthForm'
import { supabase } from '../lib/supabase'

describe('formulário de login hospedado simulado', () => {
  it('usa somente e-mail e não chama a função de username local', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({ data: { session: { user: { id: 'fiction' } } }, error: null } as never)
    render(<AuthForm register={false} method="email" />)
    await user.type(screen.getByLabelText('E-mail'), 'leitor@example.invalid')
    await user.type(screen.getByLabelText('Senha'), 'fiction-only')
    await user.click(screen.getByRole('button', { name: /Entrar/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Entrada realizada')
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'leitor@example.invalid', password: 'fiction-only' })
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })
  it('recusa username antes de acessar Auth', async () => {
    const user = userEvent.setup()
    render(<AuthForm register={false} method="email" />)
    await user.type(screen.getByLabelText('E-mail'), 'leitor')
    await user.type(screen.getByLabelText('Senha'), 'fiction-only')
    await user.click(screen.getByRole('button', { name: /Entrar/ }))
    expect(screen.getByText('Informe um e-mail válido.')).toBeVisible()
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })
})
