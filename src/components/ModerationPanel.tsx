import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { auditLabels, createDiscussionRepository, discussionMessage, reasonLabels, stateLabels } from '../discussion/repository'
import type { Moderation, ModerationItem, Queue } from '../discussion/repository'
import '../discussion/discussion.css'
const repository = createDiscussionRepository(supabase)
export function ModerationLink({ selected }: { selected: boolean }) {
  const [allowed, setAllowed] = useState(false)
  useEffect(() => { let active = true; repository.ownerAccess().then(value => { if (active) setAllowed(value) }).catch(() => { if (active) setAllowed(false) }); return () => { active = false } }, [])
  return allowed ? <a className="button secondary" href={selected ? '#admin' : '#admin/moderacao'} aria-current={selected ? 'page' : undefined}>Moderação de reflexões</a> : null
}
export function ModerationPanel() {
  const [queue, setQueue] = useState<Queue>('pending'), [page, setPage] = useState(0), [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<Moderation | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('contact'), [notice, setNotice] = useState('')
  const alive = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    let active = true
    repository.queue(queue, page).then(value => { if (active) { setData(value); setError('') } }).catch(error => { if (active) { setData(null); setError(discussionMessage(error)) } })
    return () => { active = false }
  }, [queue, page, attempt])
  async function decide(item: ModerationItem, action: string) {
    setBusy(true); setError(''); setNotice('')
    try { await repository.moderate(item.id, item.version, action, action === 'approve' ? 'reviewed' : reason); if (alive.current) { setData(null); setAttempt(n => n + 1); setNotice('Decisão registrada em auditoria.') } }
    catch (error) { if (alive.current) { setData(null); setError(discussionMessage(error)) } }
    finally { if (alive.current) setBusy(false) }
  }
  return <section className="discussion moderation reflection" aria-label="Moderação OWNER">
    <h2>Moderação de reflexões</h2><p>Acesso exclusivo do proprietário. Não aprove dados de contato, assédio, ameaças, exposição pessoal ou spam. A comunidade pode incluir adolescentes. Avalie o texto integral, sem publicar informações privadas.</p>
    <div className="actions">{([['pending', 'Pendentes'], ['reports', 'Denúncias'], ['history', 'Histórico de ações']] as const).map(([key, label]) => <button className="button secondary" aria-pressed={queue === key} disabled={busy} key={key} onClick={() => { setData(null); setError(''); setQueue(key); setPage(0); setAttempt(n => n + 1) }}>{label}</button>)}
      <button className="text-link" disabled={busy} onClick={() => { setData(null); setAttempt(n => n + 1) }}>Atualizar moderação</button></div>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error} Acesso OWNER é verificado em cada consulta e decisão.</p>}
    {!data && !error && <p role="status">Carregando moderação…</p>}
    {data && <>
      <label>Motivo para rejeitar ou ocultar<select value={reason} disabled={busy} onChange={e => setReason(e.target.value)}>{Object.entries(reasonLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      {!data.items.length && <p>Nenhum item nesta fila.</p>}
      <ul className="reflection-list">{data.items.map(item => <li key={item.id}>
        <h3>{item.title}</h3><p><time dateTime={item.day}>{item.day}</time></p>
        {'body' in item ? <><p>@{item.username ?? 'username indisponível'} · {stateLabels[item.state]} · versão {item.version}</p><p className="reflection-body">{item.body}</p>
          {!item.available && <p>Publicação indisponível. Aprovação bloqueada.</p>}
          {item.reports.map((report, i) => <p key={i}>Denúncia: {reasonLabels[report.reason as keyof typeof reasonLabels] ?? 'Outro problema'} · {report.day}</p>)}
          <div className="actions"><button className="button" disabled={busy || !item.available} onClick={() => void decide(item, 'approve')}>{queue === 'reports' ? 'Manter aprovado e encerrar denúncias' : 'Aprovar reflexão'}</button>
            {item.state === 'pending' && <button className="button secondary" disabled={busy} onClick={() => void decide(item, 'reject')}>Rejeitar reflexão</button>}
            {item.state === 'approved' && <button className="button secondary" disabled={busy} onClick={() => void decide(item, 'hide')}>Ocultar reflexão</button>}</div></>
          : <p>Ação: {auditLabels[item.action] ?? 'Revisão'} · responsável: {item.actor ? '@' + item.actor : 'conta indisponível'} · versão {item.version} · motivo: {item.reason === 'reviewed' ? 'Revisão concluída' : reasonLabels[item.reason as keyof typeof reasonLabels] ?? 'envio do autor'}</p>}
      </li>)}</ul>
      <div className="actions"><button className="button secondary" disabled={busy || page === 0} onClick={() => { setData(null); setPage(n => n - 1) }}>Fila anterior</button><span>Página {page + 1}</span>
        <button className="button secondary" disabled={busy || (page + 1) * 20 >= data.total} onClick={() => { setData(null); setPage(n => n + 1) }}>Próxima fila</button></div>
    </>}
  </section>
}
