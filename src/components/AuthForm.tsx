import { useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from './UI'
import { environmentName, loginMethod, supabase } from '../lib/supabase'
import { authMessage, signupMessage } from '../auth/auth'
import { normalizeUsername } from '../profiles/username'
import { normalizeWhatsApp } from '../profiles/whatsapp'
import { emailPasswordLogin, normalizeEmailLogin, normalizeLoginIdentifier, passwordLogin } from '../auth/passwordLogin'

export function AuthForm({ register, method = loginMethod, googleEnabled = environmentName === 'STAGING' }: { register: boolean; method?: 'local' | 'email'; googleEnabled?: boolean }) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState('')
  const [pending, setPending] = useState(false)
  const [googlePending, setGooglePending] = useState(false)
  const [failure, setFailure] = useState('')
  const [country, setCountry] = useState('BR')
  const [dialCode, setDialCode] = useState('+55')
  const fields = [...(register ? [{ name: 'name', label: 'Nome', type: 'text', placeholder: 'Seu nome' }, { name: 'username', label: 'Username', type: 'text', placeholder: 'seu_username' },{ name:'whatsapp',label:'WhatsApp com DDD',type:'tel',placeholder:'11 99999-9999' }, { name: 'email', label: 'E-mail', type: 'email', placeholder: 'voce@exemplo.com' }] : [{ name: 'identifier', label: method === 'email' ? 'E-mail' : 'Usuário ou e-mail', type: 'text', placeholder: method === 'email' ? 'voce@exemplo.com' : 'seu_username ou voce@exemplo.com' }]), { name: 'password', label: 'Senha', type: 'password', placeholder: 'Pelo menos 8 caracteres' }, ...(register ? [{ name: 'confirm', label: 'Confirmar senha', type: 'password', placeholder: 'Repita sua senha' }] : [])]
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const values = new FormData(form)
    const get = (key: string) => ['password', 'confirm'].includes(key) ? String(values.get(key) ?? '') : String(values.get(key) ?? '').trim()
    const next: Record<string, string> = {}
    if (register && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get('email'))) next.email = 'Informe um e-mail válido.'
    if (!register) {
      try { (method === 'email' ? normalizeEmailLogin : normalizeLoginIdentifier)(get('identifier')) } catch { next.identifier = method === 'email' ? 'Informe um e-mail válido.' : 'Informe seu usuário ou um e-mail válido.' }
    }
    if (get('password').length < 8) next.password = 'Use pelo menos 8 caracteres.'
    if (register) {
      if (!get('name') || [...get('name')].length > 150) next.name = 'Informe um nome de até 150 caracteres.'
      try { normalizeUsername(get('username')) } catch (error) { next.username = (error as Error).message }
      if (!/^\+[1-9][0-9]{0,2}$/.test(get('country'))) next.country = 'Informe um código internacional válido, iniciado por +.'
      else try { normalizeWhatsApp(get('country') + get('whatsapp')) } catch (error) { next.whatsapp = (error as Error).message }
      if (get('confirm') !== get('password')) next.confirm = 'As senhas precisam ser iguais.'
    }
    setErrors(next)
    setSuccess(''); setFailure('')
    if (Object.keys(next).length) { form.querySelector<HTMLInputElement>(`[name="${Object.keys(next)[0]}"]`)?.focus(); return }
    if (pending) return
    setPending(true)
    try {
      if (register) {
        const result = await supabase.auth.signUp({ email: get('email'), password: get('password'), options: { emailRedirectTo: location.origin, data: { name: get('name'), username: normalizeUsername(get('username')),whatsapp:normalizeWhatsApp(get('country') + get('whatsapp')),feedback_contact_allowed:values.get('feedback_contact')==='on' } } })
        if (result.error) throw result.error
        setSuccess(result.data.session ? 'Cadastro concluído. Você já está conectado.' : 'Se o cadastro puder ser realizado, verifique seu e-mail e confirme o endereço antes de entrar, caso a confirmação seja solicitada.')
      } else if (method === 'email') await emailPasswordLogin(supabase, get('identifier'), get('password'))
      else await passwordLogin(supabase, get('identifier'), get('password'))
      if (!register) setSuccess('Entrada realizada com sucesso.')
      form.reset(); setCountry('BR'); setDialCode('+55')
    } catch (error) { setFailure(register ? signupMessage(error) : authMessage(error)) }
    finally { setPending(false) }
  }
  async function enterWithGoogle() {
    if (!googleEnabled || pending || googlePending) return
    setGooglePending(true); setFailure(''); setSuccess('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + '/' },
      })
      if (error) throw error
    } catch (error) { setFailure(authMessage(error)) }
    finally { setGooglePending(false) }
  }
  return <div className="auth-layout"><div className="auth-intro"><div className="eyebrow">SEU ENCONTRO DIÁRIO COM DEUS</div><h1>Uma pausa.<br />Uma palavra.<br /><em>Um novo começo.</em></h1><p>Cultive a fé nos pequenos momentos e encontre inspiração para cada dia.</p><Icon name="book" /></div><section className="auth-card"><div className="eyebrow">BEM-VINDO AO SELAH</div><h2>{register ? 'Comece sua jornada' : 'Que bom te ver de novo'}</h2><p>{register ? 'Crie sua conta para começar.' : method === 'email' ? 'Entre com seu e-mail e senha.' : 'Entre com seu usuário ou e-mail e senha.'}</p><div className="info">{environmentName === 'DEV' ? 'Ambiente local de testes.' : 'Ambiente de homologação (STAGING).'} Use somente informações fictícias. O cadastro exige nome, username, e-mail, senha e WhatsApp. Pedimos o número para possibilitar pedidos individuais de feedback quando autorizados. Sem autorização, ele fica apenas no seu cadastro e não é liberado para essa finalidade. Instagram é opcional no perfil. {method === 'email' ? 'Entre com e-mail.' : 'Entre com username (com ou sem @) ou e-mail.'} As aberturas ficam no seu histórico pessoal; não indicam conclusão de leitura. Conclusões geram métricas individuais de consistência. O proprietário do Selah pode consultar username, ofensiva atual, recorde, dias com conclusão e situação de hoje para gestão e incentivo ao uso. O ranking é administrativo, não público: outros leitores e futuros publicadores não têm acesso. O WhatsApp tem finalidade e regras separadas; a autorização opcional de feedback não é reutilizada para acessar métricas. <a href={'#privacidade'}>Política de privacidade</a></div>{success && <div className="success" role="status">{success} <a href="#inicio">Explorar devocionais →</a></div>}{failure && <div className="info" role="alert">{failure}</div>}<form noValidate autoComplete="off" onSubmit={submit}><div className={register ? 'form-grid' : 'form-stack'}>{fields.map(f => f.name === 'whatsapp' ? <fieldset className="phone-group full-width" key={f.name}><legend>WhatsApp</legend><div className="phone-row"><label>País<select aria-label="País" value={country} onChange={e => { setCountry(e.target.value); setDialCode(e.target.value === 'BR' ? '+55' : '+'); setSuccess('') }}><option value="BR">Brasil (+55)</option><option value="other">Outro país</option></select></label><label>Código<input name="country" type="tel" aria-label="Código internacional do país" aria-invalid={Boolean(errors.country)} aria-describedby={errors.country ? "country-error" : undefined} value={dialCode} onChange={e => { setDialCode(e.target.value); setCountry(e.target.value === '+55' ? 'BR' : 'other'); setSuccess('') }} />{errors.country && <span className="field-error" id="country-error">{errors.country}</span>}</label><label>Telefone<input name="whatsapp" type="tel" autoComplete="tel-national" aria-label="WhatsApp com DDD" placeholder={country === 'BR' ? '11 99999-9999' : 'Número nacional'} aria-invalid={Boolean(errors.whatsapp)} aria-describedby={errors.whatsapp ? 'whatsapp-error' : undefined} onChange={() => setSuccess('')} /></label></div>{errors.whatsapp && <span className="field-error" id="whatsapp-error">{errors.whatsapp}</span>}</fieldset> : <label key={f.name} className={['name', 'email', 'confirm'].includes(f.name) ? 'full-width' : ''}>{f.label}<input name={f.name} type={f.type} placeholder={f.placeholder} value={f.name === 'country' ? dialCode : undefined} maxLength={f.name === 'name' ? 150 : undefined} autoComplete={f.type === 'password' ? (register ? 'new-password' : 'current-password') : f.name === 'identifier' ? 'username' : f.name === 'email' ? 'email' : 'off'} aria-label={f.label} aria-invalid={Boolean(errors[f.name])} aria-describedby={errors[f.name] ? `${f.name}-error` : undefined} onChange={e => { if (f.name === 'country') setDialCode(e.target.value); setSuccess('') }} />{errors[f.name] && <span className="field-error" id={`${f.name}-error`}>{errors[f.name]}</span>}</label>)}</div>{register&&<label className="contact-choice"><input type="checkbox" name="feedback_contact" onChange={()=>setSuccess('')}/>Autorizo contato individual pelo WhatsApp para solicitar feedback sobre o Selah (opcional). Posso retirar esta autorização em Meu perfil. Não há envio automático.</label>}<button disabled={pending} className="button primary auth-submit">{register ? 'Criar conta' : 'Entrar'} →</button></form>{googleEnabled && <div className="social-auth"><p>Ou continue com sua conta Google</p><button type="button" className="button secondary" onClick={enterWithGoogle} disabled={pending || googlePending}>{googlePending ? "Conectando…" : "Continuar com Google"}</button></div>}{pending && <p role="status">Aguarde…</p>}{!register && <p><a href="#recuperar-senha">Esqueci minha senha</a></p>}<p className="auth-switch">{register ? 'Já conhece o Selah?' : 'Primeira vez por aqui?'} <a href={register ? '#login' : '#cadastro'}>{register ? 'Ir para login' : 'Conhecer o cadastro'}</a></p></section></div>
}
