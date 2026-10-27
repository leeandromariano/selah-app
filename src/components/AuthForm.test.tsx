import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { AuthForm } from './AuthForm'

describe('formulários de autenticação', () => {
  it('login com @username usa um único identificador e instala sessão oficial', async () => {
    const user = userEvent.setup()
    render(<AuthForm register={false} />)
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Usuário ou e-mail'), ' @PESSOA_01 ')
    await user.type(screen.getByLabelText('Senha'), 'fiction-password')
    await user.click(screen.getByRole('button', { name: /Entrar/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Entrada realizada')
    expect(supabase.functions.invoke).toHaveBeenCalledWith('password-login', { body: { identifier: 'pessoa_01', password: 'fiction-password' } })
    expect(supabase.auth.setSession).toHaveBeenCalledOnce()
  })
  it('exibe limitação do servidor sem revelar existência da conta', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: null, error: { context: { status: 429 }, message: 'private@example.invalid' } } as never)
    const user = userEvent.setup()
    render(<AuthForm register={false} />)
    await user.type(screen.getByLabelText('Usuário ou e-mail'), 'pessoa_01')
    await user.type(screen.getByLabelText('Senha'), 'fiction-password')
    await user.click(screen.getByRole('button', { name: /Entrar/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas')
    expect(screen.queryByText(/private@example/)).not.toBeInTheDocument()
    expect(supabase.auth.setSession).not.toHaveBeenCalled()
  })
  it('WhatsApp é obrigatório mas autorização de feedback inicia desmarcada e é opcional', async()=>{
    const user=userEvent.setup();render(<AuthForm register/>)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    for(const [label,value] of [['Username','pessoa_01'],['E-mail','fiction@example.invalid'],['Senha','fiction-password'],['Confirmar senha','fiction-password']])await user.type(screen.getByLabelText(label),value)
    await user.click(screen.getByRole('button',{name:/Criar conta/}))
    expect(screen.getByText(/Informe WhatsApp com/)).toBeVisible();expect(supabase.auth.signUp).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('WhatsApp com código do país e DDD'),'+55 11 99999-0000')
    await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button',{name:/Criar conta/}))
    expect(supabase.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({options:{emailRedirectTo:location.origin,data:{username:'pessoa_01',whatsapp:'+5511999990000',feedback_contact_allowed:true}}}))
  })
  it('erro interno de login continua genérico, sem confundir com cadastro/username', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ error: { context: { status: 503 }, message: 'other@example.invalid' } } as never)
    const user = userEvent.setup()
    render(<AuthForm register={false} />)
    await user.type(screen.getByLabelText('Usuário ou e-mail'),'fiction@example.invalid')
    await user.type(screen.getByLabelText('Senha'),'fiction-password')
    await user.click(screen.getByRole('button',{name:/Entrar/}))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir')
    expect(screen.queryByText(/Cadastro não concluído/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
  })
  it('recusa cadastro sem username mesmo com e-mail e senha válidos', async () => {
    const user = userEvent.setup()
    render(<AuthForm register />)
    for(const [label,value] of [['WhatsApp com código do país e DDD','+55 11 99999-0000'],['E-mail','fiction@example.invalid'],['Senha','fiction-password'],['Confirmar senha','fiction-password']]) await user.type(screen.getByLabelText(label),value)
    await user.click(screen.getByRole('button',{name:/Criar conta/}))
    expect(screen.getByText(/Use de 3 a 24/)).toBeVisible()
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
  })
  it('trata rejeição HTTP 500 sem code do Auth sem expor diagnóstico ou email de terceiros', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({ error: { status: 500, message: 'private other@example.invalid' } } as never)
    const user = userEvent.setup()
    render(<AuthForm register />)
    for(const [label,value] of [['WhatsApp com código do país e DDD','+55 11 99999-0000'], ['Username','pessoa_01'],['E-mail','fiction@example.invalid'],['Senha','fiction-password'],['Confirmar senha','fiction-password']]) await user.type(screen.getByLabelText(label),value)
    await user.click(screen.getByRole('button',{name:/Criar conta/}))
    expect(await screen.findByRole('alert')).toHaveTextContent('username pode estar indisponível')
    expect(screen.queryByText(/other@example/)).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('rejeita entrada inválida e foca o primeiro campo com erro', async () => {
    const user = userEvent.setup()
    render(<AuthForm register={false} />)
    const email = screen.getByLabelText('Usuário ou e-mail')
    await user.type(email, 'invalido!')
    await user.type(screen.getByLabelText('Senha'), 'curta')
    await user.click(screen.getByRole('button', { name: /Entrar/ }))
    expect(screen.getByText('Informe seu usuário ou um e-mail válido.')).toBeVisible()
    expect(screen.getByText('Use pelo menos 8 caracteres.')).toBeVisible()
    expect(email).toHaveFocus()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('cadastra com confirmação, limpa campos e usa somente a fronteira simulada', async () => {
    const user = userEvent.setup()
    render(<AuthForm register />)
    for (const label of [/Nome/i, /Celular/i, /Idade/i, /Instagram/i]) expect(screen.queryByLabelText(label)).not.toBeInTheDocument()
    for (const [label, value] of [
      ['WhatsApp com código do país e DDD','+55 11 99999-0000'], ['Username', ' Pessoa_01 '], ['E-mail', 'pessoa@example.test'],
      ['Senha', 'senha-ficticia'], ['Confirmar senha', 'senha-ficticia'],
    ]) await user.type(screen.getByLabelText(label), value)
    await user.click(screen.getByRole('button', { name: /Criar conta/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Confirme seu endereço')
    expect(supabase.auth.signUp).toHaveBeenCalledWith({ email: 'pessoa@example.test', password: 'senha-ficticia', options: { emailRedirectTo: location.origin, data: { username: 'pessoa_01', whatsapp: '+5511999990000', feedback_contact_allowed: false } } })
    expect(screen.getByLabelText('E-mail')).toHaveValue('')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
    expect(fetch).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('E-mail'), 'outra@example.invalid')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('recusa cadastro incompleto e senhas divergentes', async () => {
    const user = userEvent.setup()
    render(<AuthForm register />)
    await user.type(screen.getByLabelText('Senha'), 'senha-ficticia')
    await user.click(screen.getByRole('button', { name: /Criar conta/ }))
    for (const message of ['Informe um e-mail válido.', 'As senhas precisam ser iguais.']) {
      expect(screen.getByText(message)).toBeVisible()
    }
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('envia login preservando espaços na senha e apresenta erros em português', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ error: { context: { status: 401 } } } as never)
    const user = userEvent.setup()
    render(<AuthForm register={false} />)
    await user.type(screen.getByLabelText('Usuário ou e-mail'), 'pessoa@example.test')
    await user.type(screen.getByLabelText('Senha'), ' senha-ficticia ')
    await user.click(screen.getByRole('button', { name: /Entrar/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário, e-mail ou senha inválidos')
    expect(supabase.functions.invoke).toHaveBeenCalledWith('password-login', { body: { identifier: 'pessoa@example.test', password: ' senha-ficticia ' } })
    await user.click(screen.getByRole('button', { name: /Entrar/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Entrada realizada')
  })

  it('bloqueia envio repetido durante login e informa credenciais inválidas', async () => {
    let finish!: (value: never) => void
    vi.mocked(supabase.functions.invoke).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const user = userEvent.setup()
    render(<AuthForm register={false} />)
    await user.type(screen.getByLabelText('Usuário ou e-mail'), 'fiction@example.invalid')
    await user.type(screen.getByLabelText('Senha'), 'fiction-password')
    const button = screen.getByRole('button', { name: /Entrar/ })
    await user.click(button)
    expect(button).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Aguarde')
    await user.click(button)
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ error: { context: { status: 401 } } } as never) })
    expect(screen.getByRole('alert')).toHaveTextContent('Usuário, e-mail ou senha inválidos')
    expect(button).toBeEnabled()
  })

  it('falha de rede no cadastro não apresenta sucesso nem limpa os campos', async () => {
    vi.mocked(supabase.auth.signUp).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<AuthForm register />)
    for (const [label, value] of [['WhatsApp com código do país e DDD','+55 11 99999-0000'], ['Username', 'pessoa_02'], ['E-mail', 'fiction@example.invalid'], ['Senha', 'fiction-password'], ['Confirmar senha', 'fiction-password']]) await user.type(screen.getByLabelText(label), value)
    await user.click(screen.getByRole('button', { name: /Criar conta/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique sua conexão')
    expect(screen.getByLabelText('E-mail')).toHaveValue('fiction@example.invalid')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
