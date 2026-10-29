import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import App from '../App'
import { supabase } from '../lib/supabase'
import { AuthProvider } from './AuthContext'
import { useAuth } from './auth'
import { PasswordForm } from '../components/PasswordForm'

const session = { user: { id: 'fictional-reader', user_metadata: { role: 'admin' } } } as unknown as Session
function Probe() {
  const auth = useAuth()
  return <><p>{auth.loading ? 'loading' : auth.session ? 'signed in' : 'signed out'}</p><p>{auth.session?.user.id}</p><p>{auth.recovery ? 'recovering' : 'normal'}</p><p role="alert">{auth.error}</p><button onClick={auth.logout}>logout</button></>
}
function event(type: Parameters<Parameters<typeof supabase.auth.onAuthStateChange>[0]>[0], value: Session | null) {
  act(() => { vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0](type, value) })
}

describe('sessão e autorização', () => {
  it('acompanha troca de conta oficial e logout', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('signed out')
    event('SIGNED_IN', session)
    expect(screen.getByText('fictional-reader')).toBeVisible()
    event('SIGNED_IN', { ...session, user: { ...session.user, id: 'fictional-other' } })
    expect(screen.queryByText('fictional-reader')).not.toBeInTheDocument()
    expect(screen.getByText('fictional-other')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'logout' }))
    expect(await screen.findByText('signed out')).toBeVisible()
    expect(screen.queryByText('fictional-other')).not.toBeInTheDocument()
  })
  it('apresenta link inválido como erro de autenticação em vez de página desconhecida', async () => {
    location.hash = 'error=access_denied&error_code=otp_expired'
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('inválido ou expirou')
    expect(screen.getByRole('heading', { name: 'Que bom te ver de novo' })).toBeVisible()
    expect(screen.queryByText(/Página não encontrada/)).not.toBeInTheDocument()
  })
  it('restaura sessão, acompanha eventos e remove o listener no unmount', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null })
    const view = render(<AuthProvider><Probe /></AuthProvider>)
    expect(screen.getByText('loading')).toBeVisible()
    expect(await screen.findByText('signed in')).toBeVisible()
    event('SIGNED_OUT', null)
    expect(screen.getByText('signed out')).toBeVisible()
    const subscription = vi.mocked(supabase.auth.onAuthStateChange).mock.results.at(-1)!.value.data.subscription
    view.unmount()
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('signed in')).toBeVisible()
  })

  it('não restaura uma sessão antiga depois de receber SIGNED_OUT', async () => {
    let finish!: (value: Awaited<ReturnType<typeof supabase.auth.getSession>>) => void
    vi.mocked(supabase.auth.getSession).mockReturnValue(new Promise(resolve => { finish = resolve }))
    render(<AuthProvider><Probe /></AuthProvider>)
    event('SIGNED_OUT', null)
    await act(async () => { finish({ data: { session }, error: null }) })
    expect(screen.getByText('signed out')).toBeVisible()
  })

  it('informa falha de restauração sem liberar acesso', async () => {
    vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error('offline'))
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('signed out')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Verifique sua conexão')
  })

  it('bloqueia o painel para visitante e para leitor com metadado admin forjado', async () => {
    location.hash = 'admin'
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso restrito')
    event('SIGNED_IN', session)
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('devotional_open_counts'))
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Acesso restrito')
  })

  it('logout limpa sessão; erro de logout mantém sessão com mensagem', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null })
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({ error: { code: 'offline' } } as never)
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('signed in')
    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível')
    expect(screen.getByText('signed in')).toBeVisible()
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('signed out')).toBeVisible()
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(2)
  })

  it('ignora resposta administrativa pendente após logout', async () => {
    let finish!: (value: never) => void
    vi.mocked(supabase.rpc).mockReturnValue(new Promise(resolve => { finish = resolve }) as never)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null })
    location.hash = 'admin'
    render(<App />)
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalled())
    event('SIGNED_OUT', null)
    await act(async () => { finish({ error: null, data: [] } as never) })
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument()
  })
})

describe('recuperação de senha', () => {
  it('solicita e-mail sem revelar existência da conta e trata falha', async () => {
    const user = userEvent.setup()
    render(<AuthProvider><PasswordForm update={false} /></AuthProvider>)
    await user.type(screen.getByLabelText('E-mail'), 'fiction@example.invalid')
    await user.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Se o endereço estiver cadastrado')
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('fiction@example.invalid', { redirectTo: location.origin })
    vi.mocked(supabase.auth.resetPasswordForEmail).mockRejectedValueOnce(new Error('offline'))
    await user.clear(screen.getByLabelText('E-mail'))
    await user.type(screen.getByLabelText('E-mail'), 'fiction@example.invalid')
    await user.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique sua conexão')
  })

  it('recusa atualização sem link de recuperação mesmo com sessão comum', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null })
    render(<AuthProvider><PasswordForm update /></AuthProvider>)
    expect(await screen.findByRole('alert')).toHaveTextContent('link de recuperação válido')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('PASSWORD_RECOVERY abre formulário, valida senhas e atualiza sem privilégios', async () => {
    const user = userEvent.setup()
    render(<AuthProvider><PasswordForm update /></AuthProvider>)
    event('PASSWORD_RECOVERY', session)
    expect(location.hash).toBe('#nova-senha')
    await user.type(screen.getByLabelText('Nova senha'), 'password-fiction')
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(screen.getByRole('alert')).toHaveTextContent('confirme a mesma senha')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'password-fiction')
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Senha atualizada')
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'password-fiction' })
  })
})
