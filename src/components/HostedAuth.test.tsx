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
  for (const [label, value] of [['Username', 'pessoa_01'], ['WhatsApp com código do país e DDD', '+55 11 99999-0000'], ['E-mail', 'pessoa@example.invalid'], ['Senha', 'senha-ficticia'], ['Confirmar senha', 'senha-ficticia']]) await user.type(screen.getByLabelText(label), value)
  await user.click(screen.getByRole('button', { name: /Criar conta/ }))
}

describe('interface de homologação', () => {
  it('identifica ambiente e oferece login somente por e-mail', async () => {
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } } as never)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null })
    location.hash = 'login'
    render(<App />)
    expect((await screen.findAllByText(/Ambiente de homologação \(STAGING\)/)).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('E-mail')).toBeVisible()
    expect(screen.queryByLabelText('Usuário ou e-mail')).not.toBeInTheDocument()
    expect(screen.getByText('Conteúdo e administração no ambiente de homologação')).toBeVisible()
    expect(screen.queryByText(/Ambiente local/)).not.toBeInTheDocument()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })
  it('identifica homologação na privacidade', () => {
    render(<PrivacyPolicy />)
    expect(screen.getByText(/Informações para o ambiente de homologação/)).toBeVisible()
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
