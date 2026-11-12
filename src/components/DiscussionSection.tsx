import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createDiscussionRepository, discussionMessage, reasonLabels, stateLabels } from '../discussion/repository'
import type { Discussion } from '../discussion/repository'
import '../discussion/discussion.css'
const repository = createDiscussionRepository(supabase)
export function DiscussionSection({ devotionalId }: { devotionalId: string }) {
  const [data, setData] = useState<Discussion | null>(null)
  const [page, setPage] = useState(0), [attempt, setAttempt] = useState(0)
  const [text, setText] = useState(''), [dirty, setDirty] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true)
  const [reporting, setReporting] = useState<string | null>(null), [reason, setReason] = useState('contact')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const alive = useRef(false), request = useRef({ number: 0 }), dirtyRef = useRef(false)
  useEffect(() => { const gate = request.current; alive.current = true; return () => { alive.current = false; gate.number++ } }, [])
  async function refresh() {
    const id = ++request.current.number
    setLoading(true)
    try {
      const result = await repository.read(devotionalId, page)
      if (!alive.current || id !== request.current.number) return
      setData(result); setError('')
      if (!dirtyRef.current) setText(result.own?.body ?? '')
    } catch (error) {
      if (alive.current && id === request.current.number) { setData(null); setError(discussionMessage(error)) }
    } finally { if (alive.current && id === request.current.number) setLoading(false) }
  }
  useEffect(() => {
    const gate = request.current
    void refresh()
    // No draft replacement on focus; explicit refresh preserves unsaved text.
    return () => { gate.number++ }
    // refresh is intentionally scoped to this publication/page/request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devotionalId, page, attempt])
  async function act(work: () => Promise<void>, message: string, resetDraft = false) {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await work()
      if (!alive.current) return
      if (resetDraft) { dirtyRef.current = false; setDirty(false) }
      setNotice(message); setConfirmRemove(false); setReporting(null)
      await refresh()
    } catch (error) { if (alive.current) setError(discussionMessage(error)) }
    finally { if (alive.current) setBusy(false) }
  }
  return <section className="discussion reflection" aria-labelledby={`discussion-${devotionalId}`} aria-busy={loading || busy}>
    <h2 id={`discussion-${devotionalId}`}>Compartilhe sua reflexão</h2>
    <p>Comente aqui o que você aprendeu e refletiu com essa devocional.</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {loading && <p role="status">Carregando reflexões…</p>}
    <button className="text-link" disabled={busy || loading} onClick={() => setAttempt(n => n + 1)}>Atualizar reflexões</button>
    {data && <>
      <div className="actions" role="group" aria-label="Sua reação">
        <button className="button secondary" aria-pressed={data.reaction === 'like'} disabled={busy || loading} onClick={() => void act(() => repository.react(devotionalId, data.reaction === 'like' ? null : 'like'), 'Reação atualizada.')}>Gostei</button>
        <button className="button secondary" aria-pressed={data.reaction === 'dislike'} disabled={busy || loading} onClick={() => void act(() => repository.react(devotionalId, data.reaction === 'dislike' ? null : 'dislike'), 'Reação atualizada.')}>Não gostei</button>
      </div>
      {data.own && <p>Seu comentário: <strong>{stateLabels[data.own.state]}</strong>.</p>}
      <form onSubmit={e => { e.preventDefault(); void act(() => repository.save(devotionalId, text, data.own?.version ?? 0), '', true) }}>
        <label htmlFor={`reflection-text-${devotionalId}`}>{data.own && data.own.state !== 'removed' ? 'Editar minha reflexão' : 'Minha reflexão'} (até 1000 caracteres)</label>
        <textarea id={`reflection-text-${devotionalId}`} maxLength={1000} rows={5} value={text} disabled={busy || loading}
          onChange={e => { setText(e.target.value); setDirty(true); dirtyRef.current = true }} aria-describedby={`reflection-help-${devotionalId}`} />
        <p id={`reflection-help-${devotionalId}`}>{Array.from(text).length}/1000 caracteres</p>
        {dirty && <p className="muted">Texto ainda não enviado. Atualizar a seção preserva este rascunho nesta tela.</p>}
        <div className="actions"><button className="button" disabled={busy || loading || !text.trim() || Array.from(text).length > 1000}>{busy ? 'Enviando…' : 'Enviar para moderação'}</button>
          {data.own && data.own.state !== 'removed' && <button type="button" className="button secondary" disabled={busy || loading} onClick={() => setConfirmRemove(true)}>Remover minha reflexão</button>}
        </div>
      </form>
      {confirmRemove && data.own && <div className="info" role="group" aria-label="Confirmar remoção da reflexão"><p>Remover o texto da sua reflexão? A ação também retira sua versão aprovada.</p>
        <button className="button secondary" disabled={busy} onClick={() => void act(() => repository.remove(devotionalId, data.own!.version), 'Reflexão removida.', true)}>Confirmar remoção</button>
        <button className="text-link" disabled={busy} onClick={() => setConfirmRemove(false)}>Cancelar remoção</button></div>}
      <h3>Reflexões aprovadas</h3>
      {!data.comments.length ? <p>Ainda não há reflexões aprovadas nesta página.</p> : <ul className="reflection-list">{data.comments.map(comment => <li key={comment.id}>
        <p><strong>@{comment.username}</strong> · <time dateTime={comment.day}>{comment.day}</time>{comment.own ? ' · sua reflexão' : ''}</p>
        <p className="reflection-body">{comment.body}</p>
        {!comment.own && <button className="text-link" disabled={busy || comment.reported} onClick={() => { setReporting(comment.id); setReason('contact') }}>{comment.reported ? 'Denúncia registrada' : 'Denunciar reflexão'}</button>}
        {reporting === comment.id && <form onSubmit={e => { e.preventDefault(); void act(() => repository.report(comment.id, reason), 'Denúncia registrada para revisão do proprietário.') }}>
          <label>Motivo da denúncia<select value={reason} onChange={e => setReason(e.target.value)}>{Object.entries(reasonLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <button className="button secondary" disabled={busy}>Enviar denúncia</button><button type="button" className="text-link" onClick={() => setReporting(null)}>Cancelar denúncia</button>
        </form>}
      </li>)}</ul>}
      <div className="actions"><button className="button secondary" disabled={busy || loading || page === 0} onClick={() => setPage(n => n - 1)}>Reflexões anteriores</button>
        <span>Página {page + 1}</span><button className="button secondary" disabled={busy || loading || (page + 1) * 20 >= data.total} onClick={() => setPage(n => n + 1)}>Próximas reflexões</button></div>
    </>}
  </section>
}
