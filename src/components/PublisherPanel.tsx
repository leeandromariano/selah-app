import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/auth'
import { supabase } from '../lib/supabase'
import { createPublisherRepository, publisherMessage } from '../publisher/repository'
import type { PublisherDevotional } from '../publisher/repository'
import type { DevotionalInput } from '../admin/repository'
import { Heading } from './UI'
import { BiblePassagePicker } from './BiblePassagePicker'
import { bibleEditorialEnabled } from '../bible/editorialFeature'
import { guidedDevotionalsEnabled } from '../devotionals/guidedFeature'

const repository = createPublisherRepository(supabase)
const blank: DevotionalInput = {
  author_name: '', title: '', share_phrase: '', bible_reference: '', bible_text: '', content: '',
  reflection_question: '', practical_challenge: '', prayer_prompt: '', status: 'draft', publish_at: null,
}

export function PublisherPanel() {
  const { session, loading, recovery, publisher, publisherLoading } = useAuth()
  if (loading || publisherLoading) return <p role="status">Verificando acesso de PUBLICADOR…</p>
  if (!session || !publisher || recovery) return <div className="info" role="alert">Acesso restrito a PUBLICADORES.</div>
  return <PublisherWorkspace key={session.user.id} userId={session.user.id} />
}

function PublisherWorkspace({ userId }: { userId: string }) {
  const [items, setItems] = useState<PublisherDevotional[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [editing, setEditing] = useState<DevotionalInput & { id?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [showBiblePicker, setShowBiblePicker] = useState(false)
  const active = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => {
    let current = true
    repository.list(userId).then(data => {
      if (current) { setItems(data); setLoading(false); setReady(true); setError('') }
    }).catch(e => {
      if (current) { setError(publisherMessage(e)); setLoading(false); setReady(false) }
    })
    return () => { current = false }
  }, [userId, attempt])

  function edit(item: DevotionalInput & { id?: string }) {
    setEditing({ ...item, author_name: item.author_name ?? '' })
    setShowBiblePicker(false)
    setError(''); setNotice('')
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || busy || !ready) return
    setBusy(true); setError(''); setNotice('')
    try {
      const saved = await repository.saveDraft(userId, editing, editing.id)
      if (!active.current) return
      setItems(previous => editing.id
        ? previous.map(item => item.id === saved.id ? saved : item)
        : [saved, ...previous])
      setEditing(null)
      setNotice('Rascunho salvo. Você pode enviá-lo para revisão.')
    } catch (e) { if (active.current) setError(publisherMessage(e)) }
    finally { if (active.current) setBusy(false) }
  }
  async function submit(id: string) {
    if (busy || !ready) return
    setBusy(true); setError(''); setNotice('')
    try {
      await repository.submitForReview(id)
      const refreshed = await repository.list(userId)
      if (!active.current) return
      setItems(refreshed)
      setEditing(null)
      setNotice('Texto enviado para revisão. A publicação depende de aprovação editorial.')
    } catch (e) { if (active.current) setError(publisherMessage(e)) }
    finally { if (active.current) setBusy(false) }
  }
  const fields = [
    { key: 'title', label: 'Título' },
    { key: 'share_phrase', label: 'Frase central para compartilhar' },
    ...(!bibleEditorialEnabled ? [{ key: 'bible_reference', label: 'Referência bíblica' }, { key: 'bible_text', label: 'Texto bíblico' }] as const : []),
    { key: 'content', label: 'Reflexão' },
    { key: 'reflection_question', label: 'Para refletir' },
    ...(guidedDevotionalsEnabled ? [{ key: 'practical_challenge', label: 'Coram Deo na Prática' }, { key: 'prayer_prompt', label: 'Oração' }] as const : []),
  ] as const
  const stateLabel = (item: PublisherDevotional) => item.status === 'published' ? 'Publicado'
    : item.status === 'scheduled' ? 'Agendado'
    : item.review_requested_at ? 'Em revisão' : 'Rascunho'
  return <>
    <Heading eyebrow="MEUS TEXTOS" title="Espaço do PUBLICADOR" description="Escreva seus próprios devocionais e envie rascunhos para revisão editorial. Você não possui acesso administrativo." />
    <div className="info">A assinatura do autor aparece publicamente no devocional. Sua conta é registrada separadamente para controle de autoria e permissões. Textos enviados para revisão ficam bloqueados para edição até a devolução.</div>
    {loading ? <p role="status">Carregando seus devocionais…</p> : <>
      {error && <div className="info" role="alert">{error}</div>}
      {!ready ? <button className="button secondary" onClick={() => { setLoading(true); setAttempt(value => value + 1) }}>Tentar novamente</button> : <>
        <div className="section-heading"><h2>Meus devocionais</h2><button className="button primary" disabled={busy} onClick={() => edit(blank)}>+ Novo devocional</button></div>
        {notice && <p className="success" role="status">{notice}</p>}
        {editing && <form className="editor" onSubmit={event => void save(event)} noValidate>
          <h3>{editing.id ? 'Editar meu rascunho' : 'Novo devocional'}</h3>
          <fieldset disabled={busy}><div className="form-grid">
            <label>Autor (crédito público)<input required maxLength={120} value={editing.author_name ?? ''} onChange={event => setEditing({ ...editing, author_name: event.target.value })} /></label>
            {fields.map(field => <label key={field.key}>{field.label}<textarea required={field.key !== 'share_phrase' && !(editing.id && (field.key === 'practical_challenge' || field.key === 'prayer_prompt') && !editing.practical_challenge && !editing.prayer_prompt)} maxLength={field.key === 'share_phrase' ? 180 : field.key === 'title' || field.key === 'bible_reference' ? 200 : field.key === 'practical_challenge' || field.key === 'prayer_prompt' ? 500 : undefined} value={editing[field.key] ?? ''} onChange={event => setEditing({ ...editing, [field.key]: event.target.value })} /></label>)}
            {bibleEditorialEnabled && <div><p>Passagem: {editing.bible_reference || 'nenhuma selecionada'}{editing.bible_selection && ` · ${editing.bible_selection.translation.toUpperCase()}`}</p><button type="button" className="button secondary" onClick={() => setShowBiblePicker(value => !value)}>Selecionar passagem</button>{showBiblePicker && <BiblePassagePicker onSelect={({ reference, ...selection }) => { setEditing({ ...editing, bible_reference: reference, bible_text: null, bible_selection: selection }); setShowBiblePicker(false) }} />}</div>}
          </div><div className="actions">
            <button className="button primary" type="submit">{busy ? 'Salvando…' : 'Salvar rascunho'}</button>
            <button className="button secondary" type="button" onClick={() => setEditing(null)}>Cancelar</button>
          </div></fieldset>
        </form>}
        {!items.length && <div className="info">Você ainda não criou devocionais.</div>}
        <div className="admin-list">{items.map(item => <div className="admin-row" key={item.id}>
          <div><strong>{item.title}</strong><small>Por {item.author_name?.trim() || 'Autoria não informada'} · {item.bible_reference}</small></div>
          <span className="chip">{stateLabel(item)}</span>
          {item.status === 'draft' && !item.review_requested_at && <>
            <button className="text-link" disabled={busy} onClick={() => edit(item)}>Editar</button>
            <button className="text-link" disabled={busy} onClick={() => void submit(item.id)}>Enviar para revisão</button>
          </>}
        </div>)}</div>
      </>}
    </>}
  </>
}
