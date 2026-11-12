import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createPrayerRepository, formatDay } from '../prayer/repository'
import type { PrayerItem, PrayerList, PrayerStatus } from '../prayer/repository'

const defaultRepository = createPrayerRepository(supabase)
type Repo = typeof defaultRepository

function PrayerListView({ status, repo, reloadKey, onChange }: { status: PrayerStatus; repo: Repo; reloadKey: number; onChange: () => void }) {
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: PrayerList; error?: boolean } | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [answering, setAnswering] = useState<string | null>(null)
  const [testimony, setTestimony] = useState('')
  const [error, setError] = useState('')
  const key = `${status}:${page}:${reloadKey}`
  const data = result?.key === key ? result.data : undefined
  useEffect(() => {
    let active = true
    repo.list(status, page).then(list => { if (active) setResult({ key, data: list }) }).catch(() => { if (active) setResult({ key, error: true }) })
    return () => { active = false }
  }, [repo, status, page, key])

  async function run(action: () => Promise<unknown>) {
    setError('')
    try { await action(); setRemoving(null); setAnswering(null); setTestimony(''); onChange() }
    catch { setError('Não foi possível concluir. Tente novamente.') }
  }
  if (result?.key === key && result.error) return <p role="alert" className="info">Não foi possível carregar agora. <button type="button" className="button secondary" onClick={() => onChange()}>Tentar de novo</button></p>
  if (!data) return <p role="status">Carregando…</p>
  if (!data.items.length) return <p className="muted">{status === 'answered' ? 'Quando Deus responder um pedido, o testemunho aparece aqui.' : 'Nenhum pedido guardado ainda. Você pode guardar um no fim de qualquer devocional.'}</p>
  const pages = Math.max(1, Math.ceil(data.total / data.size))
  return <>
    <ul className="prayer-list">{data.items.map((item: PrayerItem) => <li key={item.id}>
      <blockquote>{item.request}</blockquote>
      {item.status === 'answered' ? <>
        {item.testimony && <p className="prayer-testimony">🙌 {item.testimony}</p>}
        <small>Respondida em {formatDay(item.answered_on ?? item.review_on)} · pedido de {formatDay(item.created_on)}</small>
      </> : <small>Guardado em {formatDay(item.created_on)} · revisão em {formatDay(item.review_on)}</small>}
      {answering === item.id ? <form onSubmit={event => { event.preventDefault(); void run(() => repo.answer(item.id, testimony)) }}>
        <label>Conte como Deus agiu (opcional)<textarea rows={3} maxLength={500} value={testimony} onChange={event => setTestimony(event.target.value)} /></label>
        <div className="actions"><button type="submit" className="button primary">Guardar no mural</button><button type="button" className="button secondary" onClick={() => setAnswering(null)}>Cancelar</button></div>
      </form> : removing === item.id ? <div role="alert" className="info">Excluir este pedido para sempre?
        <div className="actions"><button type="button" className="button primary" onClick={() => void run(() => repo.remove(item.id))}>Sim, excluir</button><button type="button" className="button secondary" onClick={() => setRemoving(null)}>Cancelar</button></div></div>
        : <div className="actions">
          {item.status === 'open' && <button type="button" className="button secondary" onClick={() => { setAnswering(item.id); setTestimony('') }} aria-label={`Marcar como respondido: ${item.request}`}>Marcar como respondido</button>}
          <button type="button" className="button secondary" onClick={() => setRemoving(item.id)} aria-label={`Excluir: ${item.request}`}>Excluir</button>
        </div>}
    </li>)}</ul>
    {error && <p role="alert" className="info">{error}</p>}
    {pages > 1 && <div className="actions"><button type="button" className="button secondary" disabled={page === 0} onClick={() => setPage(n => n - 1)}>Página anterior</button><span>Página {page + 1} de {pages}</span><button type="button" className="button secondary" disabled={page + 1 >= pages} onClick={() => setPage(n => n + 1)}>Próxima página</button></div>}
  </>
}

// Mural pessoal em Minha Jornada: testemunhos (pedidos respondidos) e pedidos ainda em oração.
export function PrayerMural({ repo = defaultRepository }: { repo?: Repo }) {
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey(n => n + 1)
  return <section className="prayer-mural" aria-labelledby="prayer-mural-title">
    <div className="eyebrow">NO SECRETO</div>
    <h2 id="prayer-mural-title">Mural de testemunhos</h2>
    <p className="muted">Os pedidos que Deus respondeu ficam aqui, só para você. Ninguém mais vê, nem o proprietário do app.</p>
    <PrayerListView key={`answered:${reloadKey}`} status="answered" repo={repo} reloadKey={reloadKey} onChange={reload} />
    <h3>Pedidos em oração</h3>
    <PrayerListView key={`open:${reloadKey}`} status="open" repo={repo} reloadKey={reloadKey} onChange={reload} />
  </section>
}
