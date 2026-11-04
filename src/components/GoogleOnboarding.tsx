import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/auth'
import { supabase } from '../lib/supabase'
import { normalizeUsername } from '../profiles/username'
import { normalizeWhatsApp } from '../profiles/whatsapp'

function onboardingMessage(error: unknown) {
  const code = (error as { code?: string })?.code
  if (code === '23505') return 'Este username já está em uso. Escolha outro.'
  if (code === '23514' || code === '23502') return 'Confira o username e o número de WhatsApp informado.'
  if (code === '42501') return 'Não foi possível validar sua conta Google. Saia e entre novamente.'
  return 'Não foi possível concluir o cadastro. Verifique sua conexão e tente novamente.'
}

export function GoogleOnboarding() {
  const { session, refreshGoogleOnboarding, logout } = useAuth()
  const [username, setUsername] = useState('')
  const [whatsapp, setWhatsApp] = useState('')
  const [dialCode, setDialCode] = useState('+55')
  const [name, setName] = useState('')
  const [feedbackAllowed, setFeedbackAllowed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  if (!session) return null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    let usernameValue: string, phoneValue: string
    try {
      usernameValue = normalizeUsername(username)
      phoneValue = normalizeWhatsApp(dialCode + whatsapp)
      if ([...name.trim()].length > 150) throw new Error('Nome inválido')
    } catch (error) {
      setError((error as Error).message)
      return
    }
    setError('')
    setPending(true)
    try {
      const { error } = await supabase.rpc('complete_google_onboarding', {
        p_username: usernameValue,
        p_whatsapp: phoneValue,
        p_name: name.trim() || null,
        p_feedback_contact_allowed: feedbackAllowed,
      })
      if (error) throw error
      await refreshGoogleOnboarding()
      location.hash = 'inicio'
    } catch (error) { setError(onboardingMessage(error)) }
    finally { setPending(false) }
  }

  return <section className="auth-card" aria-label="Concluir cadastro Google">
    <div className="eyebrow">CADASTRO COM GOOGLE</div>
    <h1>Falta só concluir seu perfil.</h1>
    <p>Você já entrou com sua conta Google. Para utilizar o Selah, escolha seu username e informe seu WhatsApp. Esses dados são necessários também no cadastro tradicional.</p>
    <p>O WhatsApp não será utilizado para solicitar feedback sem sua autorização específica. A opção abaixo inicia desmarcada e pode ser alterada posteriormente.</p>
    {error && <p role="alert" className="info">{error}</p>}
    <form onSubmit={submit} noValidate className="form-stack">
      <label>Username
        <input autoComplete="username" maxLength={24} value={username} onChange={e => setUsername(e.target.value)} placeholder="seu_username" disabled={pending} required/>
      </label>
      <fieldset className="phone-group">
        <legend>WhatsApp obrigatório</legend>
        <div className="phone-row">
          <label>Código internacional
            <input type="tel" autoComplete="tel-country-code" value={dialCode} onChange={e => setDialCode(e.target.value)} disabled={pending} required/>
          </label>
          <label>Número com DDD
            <input type="tel" autoComplete="tel-national" placeholder="11 99999-9999" value={whatsapp} onChange={e => setWhatsApp(e.target.value)} disabled={pending} required/>
          </label>
        </div>
      </fieldset>
      <label>Nome (opcional)
        <input autoComplete="name" maxLength={150} value={name} onChange={e => setName(e.target.value)} disabled={pending}/>
      </label>
      <label className="contact-choice">
        <input type="checkbox" checked={feedbackAllowed} disabled={pending} onChange={e => setFeedbackAllowed(e.target.checked)}/>
        Autorizo contato individual pelo WhatsApp para solicitar feedback sobre o Selah (opcional). Posso revogar essa autorização no perfil.
      </label>
      <p>Leia nossa <a href="/#privacidade" target="_blank" rel="noopener noreferrer">Política de privacidade</a>.</p>
      <button className="button primary" disabled={pending} type="submit">{pending ? 'Salvando…' : 'Concluir cadastro'}</button>
    </form>
    <button className="button secondary" type="button" disabled={pending} onClick={logout}>Sair da conta Google</button>
  </section>
}
