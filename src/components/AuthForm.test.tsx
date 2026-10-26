import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AuthForm } from './AuthForm'

describe('formulários demonstrativos', () => {
  it('rejeita entrada inválida e foca o primeiro campo com erro', async () => {
    const user = userEvent.setup()
    render(<AuthForm register={false} />)
    const email = screen.getByLabelText('E-mail')
    await user.type(email, 'invalido')
    await user.type(screen.getByLabelText('Senha'), 'curta')
    await user.click(screen.getByRole('button', { name: /Validar entrada/ }))
    expect(screen.getByText('Informe um e-mail válido.')).toBeVisible()
    expect(screen.getByText('Use pelo menos 8 caracteres.')).toBeVisible()
    expect(email).toHaveFocus()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('valida cadastro fictício, limpa os campos e não envia requisição', async () => {
    const user = userEvent.setup()
    render(<AuthForm register />)
    for (const [label, value] of [
      ['Nome completo', 'Pessoa Fictícia'], ['Celular com DDD', '(11) 99999-0000'],
      ['Idade', '25'], ['E-mail', 'pessoa@example.test'],
      ['Senha', 'senha-ficticia'], ['Confirmar senha', 'senha-ficticia'],
    ]) await user.type(screen.getByLabelText(label), value)
    await user.click(screen.getByRole('button', { name: /Validar cadastro/ }))
    expect(screen.getByRole('status')).toHaveTextContent('não cria contas nem autentica usuários')
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
    await user.click(screen.getByRole('button', { name: /Validar cadastro/ }))
    for (const message of ['Informe nome e sobrenome.', 'Informe DDD e celular com 9 dígitos.',
      'Informe uma idade entre 1 e 120 anos.', 'As senhas precisam ser iguais.']) {
      expect(screen.getByText(message)).toBeVisible()
    }
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
