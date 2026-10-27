import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/auth'
import { supabase } from '../lib/supabase'
import { ageRanges, createProfileRepository, profileFields, profileMessage } from '../profiles/profile'
import type { Profile, ProfileFields } from '../profiles/profile'
import { Heading } from './UI'
import { AccountPrivacy } from './AccountPrivacy'
import { UsernameField } from './UsernameField'

const repository = createProfileRepository(supabase)
const blank: ProfileFields = { name: '', phone: null, age_range: null, instagram: null }
const labels = ['Menos de 18 anos', '18 a 24 anos', '25 a 34 anos', '35 a 44 anos', '45 a 59 anos', '60 anos ou mais']

export function ProfileForm() {
  const { session, loading, recovery } = useAuth()
  if (loading) return <p role="status">Carregando sessão…</p>
  if (!session || recovery) return <div className="info" role="alert">Entre na sua conta para acessar seu perfil. <a href="#login">Entrar</a></div>
  return <ReaderProfile key={session.user.id} userId={session.user.id} metadata={session.user.user_metadata} />
}

function ReaderProfile({ userId, metadata }: { userId: string; metadata: Record<string, unknown> }) {
  const [initialMetadata] = useState(metadata)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fields, setFields] = useState<ProfileFields>(blank)
  const [legacyFields, setLegacyFields] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    repository.load(userId).then(data => {
      if (!active) return
      setProfile(data)
      // Metadata is only a draft for this user's editable fields, never authorization.
      const draft = initialMetadata?.profile
      const candidate = draft && typeof draft === 'object' ? draft as Record<string, unknown> : {}
      setLegacyFields(Boolean(data ? data.age_range : candidate.age_range))
      setFields(data ?? { name: typeof candidate.name === 'string' ? candidate.name : '', phone: typeof candidate.phone === 'string' ? candidate.phone : null, age_range: typeof candidate.age_range === 'string' ? candidate.age_range : null, instagram: typeof candidate.instagram === 'string' ? candidate.instagram : null })
      setReady(true); setError(''); setLoading(false)
    }).catch(error => { if (active) { setError(profileMessage(error)); setLoading(false) } })
    return () => { active = false }
  }, [userId, attempt, initialMetadata])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || saving) return
    let allowed: ProfileFields
    try { allowed = profileFields(fields) } catch (error) { setError((error as Error).message); return }
    setSaving(true); setError(''); setMessage('')
    try {
      const saved = await repository.save(userId, allowed, Boolean(profile))
      setProfile(saved); setFields(saved); setMessage('Perfil salvo com sucesso.')
    } catch (error) { setError(profileMessage(error)) }
    finally { setSaving(false) }
  }
  function change(key: keyof ProfileFields, value: string) { setFields(previous => ({ ...previous, [key]: value })); setMessage(''); setError('') }
  if (loading) return <p role="status">Carregando seu perfil…</p>
  return <><Heading eyebrow="SEU ESPAÇO NO SELAH" title="Meu perfil" description="Cuide dos seus dados pessoais." /><section className="auth-card">
    {error && <div className="info" role="alert">{error}</div>}
    {!ready ? <button className="button secondary" onClick={() => { setLoading(true); setAttempt(value => value + 1) }}>Tentar novamente</button> : <>
      {!profile && <div className="info">Seu perfil ainda não foi criado. Confira seus dados e salve para concluir.</div>}
      {message && <div className="success" role="status">{message}</div>}
      <form className="form-grid" onSubmit={submit} noValidate>
        <label className="full-width">Nome de exibição (opcional)<input name="name" autoComplete="nickname" maxLength={150} value={fields.name ?? ''} onChange={e => change('name', e.target.value)} /></label>
        <label>WhatsApp (opcional)<input name="phone" type="tel" autoComplete="tel" placeholder="(11) 99999-0000 ou +5511999990000" value={fields.phone ?? ''} onChange={e => change('phone', e.target.value)} /></label>
        {legacyFields && <><p className="full-width">Faixa etária legada: pode ser corrigida ou limpa. Limpar o perfil não remove cópias antigas de Auth.</p>
        <label>Faixa etária (opcional)<select name="age_range" value={fields.age_range ?? ''} onChange={e => change('age_range', e.target.value)}><option value="">Prefiro não informar</option>{ageRanges.map((range, index) => <option value={range} key={range}>{labels[index]}</option>)}</select></label>
        </>}
        <label>Instagram (opcional)<input name="instagram" maxLength={31} value={fields.instagram ?? ''} onChange={e => change('instagram', e.target.value)} /></label>
        <button className="button primary full-width" disabled={saving}>{saving ? 'Salvando…' : 'Salvar perfil'}</button>
      </form>
    </>}
    <AccountPrivacy userId={userId} />
    <UsernameField userId={userId} />
  </section></>
}
