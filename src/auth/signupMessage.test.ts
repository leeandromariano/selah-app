import { describe, expect, it } from 'vitest'
import { signupMessage } from './auth'

describe('mensagem de erro do cadastro', () => {
  it.each(['user_already_exists', 'email_exists'])('e-mail já cadastrado (%s) orienta a entrar ou recuperar a senha, sem confirmar o cadastro', code => {
    const message = signupMessage({ status: 422, code })
    expect(message).toContain('Se este e-mail já tiver cadastro')
    expect(message).toContain('Esqueci minha senha')
    expect(message).not.toMatch(/conexão/)
  })
  it('falha do banco continua apontando username e WhatsApp', () => {
    expect(signupMessage({ status: 500, code: 'unexpected_failure' })).toContain('username')
  })
  it('erro desconhecido continua genérico', () => {
    expect(signupMessage({ status: 422, code: 'outro' })).toContain('Verifique sua conexão')
  })
})
