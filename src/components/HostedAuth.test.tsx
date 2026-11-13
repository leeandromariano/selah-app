import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { AuthForm } from './AuthForm'
import { PrivacyPolicy } from './PrivacyPolicy'
import App from '../App'

vi.mock('../lib/supabase', () => ({ environmentName: 'STAGING', loginMethod: 'email', supabase: {
  auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn(), setSession: vi.fn(), signOut: vi.fn(), resetPasswordForEmail: vi.fn(), updateUser: vi.fn() },
  functions: { invoke: vi.fn() }, rpc: vi.fn(), from: vi.fn(),
} }))

async function fillRegistration() {
  const user = userEvent.setup()
  for (const [label, value] of [['Nome', 'Pessoa fictícia'], ['Username', 'pessoa_01'], ['WhatsApp com DDD', '11 99999-0000'], ['E-mail', 'pessoa@example.invalid'], ['Senha', 'senha-ficticia'], ['Confirmar senha', 'senha-ficticia']]) await user.type(screen.getByLabelText(label), value)
  await user.click(screen.getByRole('button', { name: /Criar conta/ }))
}

describe('interface em ambiente hospedado', () => {
  it('oferece login somente por e-mail sem identificar o ambiente', async () => {
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } } as never)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null })
    location.hash = 'login'
    render(<App />)
    expect(await screen.findByLabelText('E-mail')).toBeVisible()
    expect(screen.queryByText(/homologação|STAGING|Ambiente local|dados fictícios|informações fictícias/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Usuário ou e-mail')).not.toBeInTheDocument()
    expect(screen.queryByText(/Conteúdo e administração no ambiente/)).not.toBeInTheDocument()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })
  it('no método hospedado o campo aceita username ou e-mail: e-mail entra direto, username usa a função', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: { session: { user: { id: 'f' } } }, error: null } as never)
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { access_token: 'a', refresh_token: 'r' }, error: null } as never)
    vi.mocked(supabase.auth.setSession).mockResolvedValue({ data: { session: { user: { id: 'f' } } }, error: null } as never)
    const view = render(<AuthForm register={false} method="hosted" />)
    await user.type(screen.getByLabelText('Usuário ou e-mail'), 'pessoa@example.invalid')
    await user.type(screen.getByLabelText('Senha'), 'senha-ficticia')
    await user.click(screen.getByRole('button', { name: /Entrar/ }))
    await screen.findByText('Entrada realizada com sucesso.')
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'pessoa@example.invalid', password: 'senha-ficticia' })
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
    view.unmount()
    vi.mocked(supabase.auth.signInWithPassword).mockClear()
    render(<AuthForm register={false} method="hosted" />)
    await user.type(screen.getByLabelText('Usuário ou e-mail'), '@Pessoa_01')
    await user.type(screen.getByLabelText('Senha'), 'senha-ficticia')
    await user.click(screen.getByRole('button', { name: /Entrar/ }))
    await screen.findByText('Entrada realizada com sucesso.')
    expect(supabase.functions.invoke).toHaveBeenCalledWith('password-login', { body: { identifier: 'pessoa_01', password: 'senha-ficticia' } })
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })
  it('política de privacidade não se apresenta como ambiente de testes', () => {
    render(<PrivacyPolicy />)
    expect(screen.getByText('Como o Coram trata as suas informações.')).toBeVisible()
    expect(screen.queryByText(/homologação|ambiente de testes|dados fictícios/i)).not.toBeInTheDocument()
  })
  it('usa a sessão retornada pelo cadastro sem novo login nem sessão fabricada', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({ data: { session: { user: { id: 'fiction' } }, user: { id: 'fiction' } }, error: null } as never)
    render(<AuthForm register />)
    await fillRegistration()
    expect(await screen.findByRole('status')).toHaveTextContent('Você já está conectado')
    expect(screen.getByRole('status')).not.toHaveTextContent(/e-mail|confirme/i)
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
    expect(supabase.auth.setSession).not.toHaveBeenCalled()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })
  it('sem sessão orienta confirmação sem prometer envio ou autenticar', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({ data: { session: null, user: { id: 'fiction' } }, error: null } as never)
    render(<AuthForm register />)
    await fillRegistration()
    expect(await screen.findByRole('status')).toHaveTextContent('confirme o endereço antes de entrar')
    expect(screen.getByRole('status')).not.toHaveTextContent('receberá')
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
    expect(supabase.auth.setSession).not.toHaveBeenCalled()
  })
  it('falha de cadastro não informa sucesso nem expõe detalhes', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({ data: { session: null, user: null }, error: { status: 500, message: 'private@example.invalid' } } as never)
    render(<AuthForm register />)
    await fillRegistration()
    expect(await screen.findByRole('alert')).toHaveTextContent('Cadastro não concluído')
    expect(screen.queryByText(/private@example/)).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
