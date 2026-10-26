import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { AuthForm } from './AuthForm'

describe('formulários de autenticação', () => {
  it('rejeita entrada inválida e foca o primeiro campo com erro', async () => {
    const user = userEvent.setup()
    render(<AuthForm register={false} />)
    const email = screen.getByLabelText('E-mail')
    await user.type(email, 'invalido')
    await user.type(screen.getByLabelText('Senha'), 'curta')
    await user.click(screen.getByRole('button', { name: /Entrar/ }))
    expect(screen.getByText('Informe um e-mail válido.')).toBeVisible()
    expect(screen.getByText('Use pelo menos 8 caracteres.')).toBeVisible()
    expect(email).toHaveFocus()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('cadastra com confirmação, limpa campos e usa somente a fronteira simulada', async () => {
    const user = userEvent.setup()
    render(<AuthForm register />)
    for (const [label, value] of [
      ['Nome completo', 'Pessoa Fictícia'], ['Celular com DDD', '(11) 99999-0000'],
      ['Idade', '25'], ['E-mail', 'pessoa@example.test'],
      ['Senha', 'senha-ficticia'], ['Confirmar senha', 'senha-ficticia'],
    ]) await user.type(screen.getByLabelText(label), value)
    await user.click(screen.getByRole('button', { name: /Criar conta/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Confirme seu endereço')
    expect(supabase.auth.signUp).toHaveBeenCalledWith({ email: 'pessoa@example.test', password: 'senha-ficticia', options: { emailRedirectTo: location.origin } })
    expect(screen.getByLabelText('E-mail')).toHaveValue('')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
    expect(fetch).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Nome completo'), 'Outra pessoa')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('recusa cadastro incompleto e senhas divergentes', async () => {
    const user = userEvent.setup()
    render(<AuthForm register />)
    await user.type(screen.getByLabelText('Senha'), 'senha-ficticia')
    await user.click(screen.getByRole('button', { name: /Criar conta/ }))
    for (const message of ['Informe nome e sobrenome.', 'Informe DDD e celular com 9 dígitos.',
      'Informe uma idade entre 1 e 120 anos.', 'As senhas precisam ser iguais.']) {
      expect(screen.getByText(message)).toBeVisible()
    }
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('envia login preservando espaços na senha e apresenta erros em português', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({ error: { code: 'email_not_confirmed' } } as never)
    const user = userEvent.setup()
    render(<AuthForm register={false} />)
    await user.type(screen.getByLabelText('E-mail'), 'pessoa@example.test')
    await user.type(screen.getByLabelText('Senha'), ' senha-ficticia ')
    await user.click(screen.getByRole('button', { name: /Entrar/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirme seu e-mail')
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'pessoa@example.test', password: ' senha-ficticia ' })
    await user.click(screen.getByRole('button', { name: /Entrar/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Entrada realizada')
  })

  it('bloqueia envio repetido durante login e informa credenciais inválidas', async () => {
    let finish!: (value: never) => void
    vi.mocked(supabase.auth.signInWithPassword).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const user = userEvent.setup()
    render(<AuthForm register={false} />)
    await user.type(screen.getByLabelText('E-mail'), 'fiction@example.invalid')
    await user.type(screen.getByLabelText('Senha'), 'fiction-password')
    const button = screen.getByRole('button', { name: /Entrar/ })
    await user.click(button)
    expect(button).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Aguarde')
    await user.click(button)
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ error: { code: 'invalid_credentials' } } as never) })
    expect(screen.getByRole('alert')).toHaveTextContent('E-mail ou senha incorretos')
    expect(button).toBeEnabled()
  })

  it('falha de rede no cadastro não apresenta sucesso nem limpa os campos', async () => {
    vi.mocked(supabase.auth.signUp).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<AuthForm register />)
    for (const [label, value] of [['Nome completo', 'Pessoa Fictícia'], ['Celular com DDD', '(11) 99999-0000'], ['Idade', '25'], ['E-mail', 'fiction@example.invalid'], ['Senha', 'fiction-password'], ['Confirmar senha', 'fiction-password']]) await user.type(screen.getByLabelText(label), value)
    await user.click(screen.getByRole('button', { name: /Criar conta/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique sua conexão')
    expect(screen.getByLabelText('E-mail')).toHaveValue('fiction@example.invalid')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
