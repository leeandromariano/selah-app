import { useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from './UI'
import { supabase } from '../lib/supabase'
import { authMessage } from '../auth/auth'

export function AuthForm({ register }: { register: boolean }) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState('')
  const fields = [...(register ? [{ name: 'name', label: 'Nome completo', type: 'text', placeholder: 'Seu nome e sobrenome' }, { name: 'phone', label: 'Celular com DDD', type: 'tel', placeholder: '(11) 99999-9999' }, { name: 'age', label: 'Idade', type: 'number', placeholder: 'Sua idade' }, { name: 'instagram', label: 'Instagram (opcional)', type: 'text', placeholder: '@seuperfil' }] : []), { name: 'email', label: 'E-mail', type: 'email', placeholder: 'voce@exemplo.com' }, { name: 'password', label: 'Senha', type: 'password', placeholder: 'Pelo menos 8 caracteres' }, ...(register ? [{ name: 'confirm', label: 'Confirmar senha', type: 'password', placeholder: 'Repita sua senha' }] : [])]
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const values = new FormData(form)
    const get = (key: string) => ['password', 'confirm'].includes(key) ? String(values.get(key) ?? '') : String(values.get(key) ?? '').trim()
    const next: Record<string, string> = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get('email'))) next.email = 'Informe um e-mail válido.'
    if (get('password').length < 8) next.password = 'Use pelo menos 8 caracteres.'
    if (register) {
      if (get('name').split(/\s+/).length < 2) next.name = 'Informe nome e sobrenome.'
      if (!/^[1-9]{2}9\d{8}$/.test(get('phone').replace(/\D/g, ''))) next.phone = 'Informe DDD e celular com 9 dígitos.'
      if (!/^\d+$/.test(get('age')) || Number(get('age')) < 1 || Number(get('age')) > 120) next.age = 'Informe uma idade entre 1 e 120 anos.'
      if (get('confirm') !== get('password')) next.confirm = 'As senhas precisam ser iguais.'
      if (get('instagram') && !/^@?[a-zA-Z0-9._]{1,30}$/.test(get('instagram'))) next.instagram = 'Informe um nome de usuário válido.'
    }
    setErrors(next)
    setSuccess(false); setFailure('')
    if (Object.keys(next).length) { form.querySelector<HTMLInputElement>(`[name="${Object.keys(next)[0]}"]`)?.focus(); return }
    if (pending) return
    setPending(true)
    try {
      const result = register
        ? await supabase.auth.signUp({ email: get('email'), password: get('password'), options: { emailRedirectTo: location.origin } })
        : await supabase.auth.signInWithPassword({ email: get('email'), password: get('password') })
      if (result.error) throw result.error
      setSuccess(true); form.reset()
    } catch (error) { setFailure(authMessage(error)) }
    finally { setPending(false) }
  }
  return <div className="auth-layout"><div className="auth-intro"><div className="eyebrow">SEU ENCONTRO DIÁRIO COM DEUS</div><h1>Uma pausa.<br />Uma palavra.<br /><em>Um novo começo.</em></h1><p>Cultive a fé nos pequenos momentos e encontre inspiração para cada dia.</p><Icon name="book" /></div><section className="auth-card"><div className="eyebrow">BEM-VINDO AO SELAH</div><h2>{register ? 'Comece sua jornada' : 'Que bom te ver de novo'}</h2><p>{register ? 'Crie sua conta para começar.' : 'Entre com seu e-mail e senha.'}</p><div className="info">Ambiente local de testes. Use somente informações fictícias. Apenas e-mail e senha são enviados; os campos pessoais ainda não são salvos.</div>{success && <div className="success" role="status">{register ? "Se o cadastro puder ser realizado, você receberá um e-mail. Confirme seu endereço para entrar." : "Entrada realizada com sucesso."} <a href="#inicio">Explorar devocionais →</a></div>}{failure && <div className="info" role="alert">{failure}</div>}<form noValidate autoComplete="off" onSubmit={submit}><div className={register ? 'form-grid' : 'form-stack'}>{fields.map(f => <label key={f.name} className={['name', 'email', 'confirm'].includes(f.name) ? 'full-width' : ''}>{f.label}<input name={f.name} type={f.type} placeholder={f.placeholder} autoComplete={f.type === 'password' ? (register ? 'new-password' : 'current-password') : f.name === 'email' ? 'email' : 'off'} aria-invalid={Boolean(errors[f.name])} aria-describedby={errors[f.name] ? `${f.name}-error` : undefined} onChange={() => setSuccess(false)} />{errors[f.name] && <span className="field-error" id={`${f.name}-error`}>{errors[f.name]}</span>}</label>)}</div><button disabled={pending} className="button primary auth-submit">{register ? 'Criar conta' : 'Entrar'} →</button></form>{pending && <p role="status">Aguarde…</p>}{!register && <p><a href="#recuperar-senha">Esqueci minha senha</a></p>}<p className="auth-switch">{register ? 'Já conhece o Selah?' : 'Primeira vez por aqui?'} <a href={register ? '#login' : '#cadastro'}>{register ? 'Ir para login' : 'Conhecer o cadastro'}</a></p></section></div>
}
