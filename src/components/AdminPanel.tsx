import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/auth'
import { supabase } from '../lib/supabase'
import { adminMessage, createAdminRepository, dateTimeInput, publicationInstant, statusLabels } from '../admin/repository'
import type { AdminDevotional, DevotionalInput, DevotionalStatus } from '../admin/repository'
import { Heading, Icon } from './UI'
import { CommunityPanel } from './CommunityPanel'
import { ModerationLink, ModerationPanel } from './ModerationPanel'

const repository = createAdminRepository(supabase)
const blank: DevotionalInput = { title: '', bible_reference: '', bible_text: '', content: '', reflection_question: '', publish_at: null, status: 'draft' }
export function AdminPanel({ community = false, moderation = false }: { community?: boolean; moderation?: boolean }) {
  const { session, loading, adminLoading, admin, recovery } = useAuth()
  if (loading || adminLoading) return <p role="status">Verificando acesso administrativo…</p>
  if (!session || !admin || recovery) return <div className="info" role="alert">Acesso restrito a administradores.</div>
  return <EditorialPanel key={session.user.id} userId={session.user.id} community={community} moderation={moderation} />
}
function EditorialPanel({ userId, community, moderation }: { userId: string; community: boolean; moderation: boolean }) {
  const [items, setItems] = useState<AdminDevotional[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [editing, setEditing] = useState<AdminDevotional | DevotionalInput | null>(null)
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const active = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => {
    let current = true
    repository.list().then(data => { if (current) { setItems(data); setLoading(false); setReady(true); setError('') } }).catch(error => { if (current) { setError(adminMessage(error)); setLoading(false); setReady(false) } })
    return () => { current = false }
  }, [attempt])
  function edit(item: AdminDevotional | DevotionalInput) { setEditing({ ...item }); setDate(dateTimeInput(item.publish_at)); setError(''); setNotice('') }
  async function save(publishNow: boolean) {
    if (!editing || saving || !ready) return
    setSaving(true); setError(''); setNotice('')
    try {
      const input = { ...editing, status: publishNow ? 'published' as const : editing.status, publish_at: publishNow ? new Date().toISOString() : publicationInstant(date, editing.publish_at) }
      const id = 'id' in editing ? editing.id : undefined
      const saved = await repository.save(userId, input, id)
      if (!active.current) return
      setItems(previous => id ? previous.map(item => item.id === id ? saved : item) : [saved, ...previous])
      setEditing(null)
      setNotice(saved.status === 'scheduled' ? 'Devocional agendado e salvo. Ele continuará oculto até a publicação explícita.' : saved.status === 'published' ? 'Devocional publicado e salvo com sucesso.' : 'Rascunho salvo com sucesso.')
    } catch (error) { if (active.current) setError(adminMessage(error)) }
    finally { if (active.current) setSaving(false) }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void save(false) }
  const format = (instant: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(instant))
  return <><Heading eyebrow="CUIDANDO DE CADA MENSAGEM" title="Painel administrativo" description="Crie, revise e publique mensagens para o acervo local." />
    <button className="button secondary" aria-expanded={community} onClick={() => { location.hash = community ? 'admin' : 'admin/comunidade' }}>Comunidade e ofensivas</button>
    {community && <CommunityPanel />}
    <ModerationLink selected={moderation} />
    {moderation && <ModerationPanel />}
    <div className="info">Agendados permanecem ocultos até uma publicação explícita. As datas da lista usam o horário de Brasília.</div>
    {loading ? <p role="status">Carregando painel…</p> : <>
      {error && <div className="info" role="alert">{error}</div>}
      {!ready ? <button className="button secondary" onClick={() => { setLoading(true); setAttempt(value => value + 1) }}>Tentar novamente</button> : <>
        <div className="stats">{[{ title: 'Devocionais', value: items.length }, ...(['draft', 'scheduled', 'published'] as const).map(status => ({ title: statusLabels[status], value: items.filter(item => item.status === status).length }))].map(stat => <div className="stat" key={stat.title}><Icon name="book" /><p>{stat.title}</p><strong>{stat.value}</strong><small>Contagem de conteúdo</small></div>)}</div>
        <div className="section-heading"><h2>Gerenciar devocionais</h2><button className="button primary" disabled={saving} onClick={() => edit(blank)}>+ Novo devocional</button></div>
        {notice && <p className="success" role="status">{notice}</p>}
        {editing && <form className="editor" onSubmit={submit} noValidate><h3>{'id' in editing ? 'Editar devocional' : 'Novo devocional'}</h3><fieldset disabled={saving}><div className="form-grid">{([{ key: 'title', label: 'Título' }, { key: 'bible_reference', label: 'Referência bíblica' }, { key: 'bible_text', label: 'Texto bíblico' }, { key: 'content', label: 'Reflexão' }, { key: 'reflection_question', label: 'Para refletir' }] as const).map(field => <label key={field.key}>{field.label}<textarea required maxLength={field.key === 'title' || field.key === 'bible_reference' ? 200 : undefined} value={editing[field.key]} onChange={event => setEditing({ ...editing, [field.key]: event.target.value })} /></label>)}
          <label>Situação<select value={editing.status} onChange={event => setEditing({ ...editing, status: event.target.value as DevotionalStatus })}>{(['draft', 'scheduled', 'published'] as const).map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
          <label>Data e hora (fuso do dispositivo)<input type="datetime-local" value={date} onChange={event => setDate(event.target.value)} /></label>
        </div><p className="muted">Fuso do editor: {Intl.DateTimeFormat().resolvedOptions().timeZone}. O acervo usa America/Sao_Paulo. Publicar agora disponibiliza o texto imediatamente.</p>
          <div className="actions"><button className="button primary">{saving ? 'Salvando…' : 'Salvar devocional'}</button><button type="button" className="button secondary" onClick={() => void save(true)}>Publicar agora</button><button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancelar</button></div></fieldset></form>}
        {!items.length && <div className="info">Nenhum devocional cadastrado.</div>}
        <div className="admin-list">{items.map(item => <div className="admin-row" key={item.id}><span className="mini-icon"><Icon name="book" /></span><div><strong>{item.title}</strong><small>{item.bible_reference} · {item.publish_at ? format(item.publish_at) : 'Sem data de publicação'}</small></div><span className="chip">{statusLabels[item.status]}</span><button className="text-link" disabled={saving} onClick={() => edit(item)}>Editar</button></div>)}</div>
      </>}
    </>}
  </>
}
