import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { authMessage, useAuth } from '../auth/auth'

export function PasswordForm({ update }: { update: boolean }) {
  const auth = useAuth()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const data = new FormData(form)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    setError(''); setMessage('')
    if (update && (password.length < 8 || password !== data.get('confirm'))) { setError('Use pelo menos 8 caracteres e confirme a mesma senha.'); return }
    if (!update && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Informe um e-mail válido.'); return }
    setPending(true)
    try {
      if (update && (!auth.session || !auth.recovery)) throw new Error('recovery_required')
      const { error } = update ? await supabase.auth.updateUser({ password }) : await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin })
      if (error) throw error
      form.reset()
      setMessage(update ? 'Senha atualizada. Você pode continuar sua navegação.' : 'Se o endereço estiver cadastrado, você receberá um link para recuperar a senha.')
      if (update) auth.finishRecovery()
    } catch (error) { setError(authMessage(error)) }
    finally { setPending(false) }
  }
  if (update && message) return <div className="success" role="status">{message} <a href="#inicio">Continuar</a></div>
  if (update && (auth.loading || !auth.session || !auth.recovery)) return <div className="info" role="alert">Abra um link de recuperação válido recebido por e-mail. <a href="#recuperar-senha">Solicitar novo link</a></div>
  return <section className="auth-card"><h2>{update ? 'Escolha uma nova senha' : 'Recuperar senha'}</h2>{error && <div className="info" role="alert">{error}</div>}{message && <p role="status">{message}</p>}<form className="form-stack" onSubmit={submit} noValidate>{update ? <><label>Nova senha<input name="password" type="password" autoComplete="new-password" /></label><label>Confirmar nova senha<input name="confirm" type="password" autoComplete="new-password" /></label></> : <label>E-mail<input name="email" type="email" autoComplete="email" /></label>}<button className="button primary" disabled={pending}>{pending ? 'Aguarde…' : update ? 'Salvar nova senha' : 'Enviar link de recuperação'}</button></form><p><a href="#login">Voltar ao login</a></p></section>
}
