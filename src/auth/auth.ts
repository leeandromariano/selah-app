import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export function authMessage(error: unknown) {
  const code = (error as { code?: string })?.code
  if (code === 'invalid_credentials') return 'Usuário, e-mail ou senha inválidos. Confira os dados e a confirmação do e-mail.'
  if (code === 'email_not_confirmed') return 'Confirme seu e-mail antes de entrar.'
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Muitas tentativas. Aguarde um pouco e tente novamente.'
  if (code === 'weak_password') return 'Escolha uma senha mais forte, com pelo menos 8 caracteres.'
  if (code === 'same_password') return 'Escolha uma senha diferente da anterior.'
  return 'Não foi possível concluir. Verifique sua conexão e tente novamente.'
}

export function signupMessage(error: unknown) {
  const failure = error as { status?: number; code?: string }
  if (failure?.status === 500 || failure?.code === 'unexpected_failure' || failure?.code === 'database_error') return 'Cadastro não concluído. O username pode estar indisponível, o WhatsApp pode ser inválido ou houve uma falha temporária. Confira os dados ou tente novamente mais tarde.'
  return authMessage(error)
}

export const AuthContext = createContext<{
  session: Session | null; loading: boolean; recovery: boolean; admin: boolean; adminLoading: boolean; error: string;
  logout: () => Promise<void>; finishRecovery: () => void;
} | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider ausente')
  return value
}
