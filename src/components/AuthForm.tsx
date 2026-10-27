import { useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from './UI'
import { supabase } from '../lib/supabase'
import { authMessage, signupMessage } from '../auth/auth'
import { normalizeUsername } from '../profiles/username'

export function AuthForm({ register }: { register: boolean }) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState('')
  const fields = [...(register ? [{ name: 'username', label: 'Username', type: 'text', placeholder: 'seu_username' }] : []), { name: 'email', label: 'E-mail', type: 'email', placeholder: 'voce@exemplo.com' }, { name: 'password', label: 'Senha', type: 'password', placeholder: 'Pelo menos 8 caracteres' }, ...(register ? [{ name: 'confirm', label: 'Confirmar senha', type: 'password', placeholder: 'Repita sua senha' }] : [])]
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const values = new FormData(form)
    const get = (key: string) => ['password', 'confirm'].includes(key) ? String(values.get(key) ?? '') : String(values.get(key) ?? '').trim()
    const next: Record<string, string> = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get('email'))) next.email = 'Informe um e-mail válido.'
    if (get('password').length < 8) next.password = 'Use pelo menos 8 caracteres.'
    if (register) {
      try { normalizeUsername(get('username')) } catch (error) { next.username = (error as Error).message }
      if (get('confirm') !== get('password')) next.confirm = 'As senhas precisam ser iguais.'
    }
    setErrors(next)
    setSuccess(false); setFailure('')
    if (Object.keys(next).length) { form.querySelector<HTMLInputElement>(`[name="${Object.keys(next)[0]}"]`)?.focus(); return }
    if (pending) return
    setPending(true)
    try {
      const result = register
        ? await supabase.auth.signUp({ email: get('email'), password: get('password'), options: { emailRedirectTo: location.origin, data: { username: normalizeUsername(get('username')) } } })
        : await supabase.auth.signInWithPassword({ email: get('email'), password: get('password') })
      if (result.error) throw result.error
      setSuccess(true); form.reset()
    } catch (error) { setFailure(register ? signupMessage(error) : authMessage(error)) }
    finally { setPending(false) }
  }
  return <div className="auth-layout"><div className="auth-intro"><div className="eyebrow">SEU ENCONTRO DIÁRIO COM DEUS</div><h1>Uma pausa.<br />Uma palavra.<br /><em>Um novo começo.</em></h1><p>Cultive a fé nos pequenos momentos e encontre inspiração para cada dia.</p><Icon name="book" /></div><section className="auth-card"><div className="eyebrow">BEM-VINDO AO SELAH</div><h2>{register ? 'Comece sua jornada' : 'Que bom te ver de novo'}</h2><p>{register ? 'Crie sua conta para começar.' : 'Entre com seu e-mail e senha.'}</p><div className="info">Ambiente local de testes. Use somente informações fictícias. O cadastro exige username, e-mail e senha. Nome pessoal, WhatsApp e Instagram são opcionais em Meu perfil. Login somente por e-mail nesta versão. As aberturas ficam no seu histórico pessoal; não indicam conclusão de leitura.</div>{success && <div className="success" role="status">{register ? "Se o cadastro puder ser realizado, você receberá um e-mail. Confirme seu endereço para entrar." : "Entrada realizada com sucesso."} <a href="#inicio">Explorar devocionais →</a></div>}{failure && <div className="info" role="alert">{failure}</div>}<form noValidate autoComplete="off" onSubmit={submit}><div className={register ? 'form-grid' : 'form-stack'}>{fields.map(f => <label key={f.name} className={['name', 'email', 'confirm'].includes(f.name) ? 'full-width' : ''}>{f.label}<input name={f.name} type={f.type} placeholder={f.placeholder} autoComplete={f.type === 'password' ? (register ? 'new-password' : 'current-password') : f.name === 'email' ? 'email' : 'off'} aria-invalid={Boolean(errors[f.name])} aria-describedby={errors[f.name] ? `${f.name}-error` : undefined} onChange={() => setSuccess(false)} />{errors[f.name] && <span className="field-error" id={`${f.name}-error`}>{errors[f.name]}</span>}</label>)}</div><button disabled={pending} className="button primary auth-submit">{register ? 'Criar conta' : 'Entrar'} →</button></form>{pending && <p role="status">Aguarde…</p>}{!register && <p><a href="#recuperar-senha">Esqueci minha senha</a></p>}<p className="auth-switch">{register ? 'Já conhece o Selah?' : 'Primeira vez por aqui?'} <a href={register ? '#login' : '#cadastro'}>{register ? 'Ir para login' : 'Conhecer o cadastro'}</a></p></section></div>
}
