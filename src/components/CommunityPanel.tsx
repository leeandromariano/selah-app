import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createCommunityRepository } from '../consistency/community'
import type { Community } from '../consistency/community'
const repository = createCommunityRepository(supabase)
const labels = { empty: 'Sem conclusões', completed_today: 'Concluído hoje', pending_today: 'Pendente hoje', interrupted: 'Ofensiva interrompida' }
export function CommunityPanel() {
  const [search, setSearch] = useState(''), [query, setQuery] = useState('')
  const [page, setPage] = useState(0), [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: Community; error?: string } | null>(null)
  const key = `${query}:${page}:${attempt}`
  const pending = result?.key !== key
  const data = !pending ? result?.data : undefined
  useEffect(() => {
    let active = true
    repository.list(query, page).then(data => { if (active) setResult({ key, data }) }).catch(() => {
      if (active) setResult({ key, error: 'Não foi possível consultar a comunidade. Acesso exclusivo do proprietário; verifique sua sessão e tente novamente.' })
    })
    return () => { active = false }
  }, [query, page, key])
  return <section className="community" aria-labelledby="community-title" aria-busy={pending}>
    <h2 id="community-title">COMUNIDADE E OFENSIVAS</h2>
    <p>Ranking administrativo exclusivo do proprietário. Indicadores para acompanhamento e incentivo; não medem fé ou valor pessoal.</p>
    {data && <div className="community-summary"><div className="stat"><p>Leitores cadastrados</p><strong>{data.total_readers}</strong><small>Total de contas no universo do painel</small></div><div className="stat"><p>Leitores com conclusão hoje</p><strong>{data.completed_today}</strong><small>Ao menos uma conclusão no dia de Brasília</small></div></div>}
    <form className="community-search" onSubmit={e => { e.preventDefault(); setQuery(search); setPage(0); setAttempt(n => n + 1) }}>
      <label>Buscar por username<input maxLength={25} value={search} onChange={e => setSearch(e.target.value)} /></label>
      <button className="button secondary">Buscar leitores</button>
    </form>
    {pending && <p role="status">Carregando comunidade…</p>}
    {!pending && result?.error && <div className="info" role="alert">{result.error} <button className="button secondary" onClick={() => setAttempt(n => n + 1)}>Repetir consulta</button></div>}
    {data && <>
      <p className="community-reference">Contas não anônimas e não excluídas, inclusive legadas, não confirmadas e contas editoriais. Referência: {data.server_today} · Brasília.</p>
      {!data.readers.length ? <p role="status">Nenhum leitor encontrado.</p> : <div className="community-table" tabIndex={0} role="region" aria-label="Ranking da comunidade com rolagem horizontal"><table>
        <caption>Ranking por ofensiva atual, em ordem decrescente.</caption>
        <thead><tr>{['Username','Ofensiva atual','Recorde','Dias com conclusão','Situação'].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead>
        <tbody>{data.readers.map((r, i) => <tr key={`${page}:${i}`}><th scope="row">{r.username ? '@' + r.username : 'Conta legada sem username'}</th><td><strong className="community-streak">{r.current_streak}</strong></td><td>{r.best_streak}</td><td>{r.total_days}</td><td><span className="community-status">{labels[r.status]}{r.status === 'empty' ? ' · ofensiva zero' : ''}</span></td></tr>)}</tbody>
      </table></div>}
      <div className="actions community-pagination"><button className="button secondary" disabled={page === 0} onClick={() => setPage(n => n - 1)}>Página anterior</button><span>Página {page + 1} de {Math.max(1, Math.ceil(data.matched_readers / data.size))} · {data.matched_readers} leitores encontrados</span><button className="button secondary" disabled={(page + 1) * data.size >= data.matched_readers} onClick={() => setPage(n => n + 1)}>Próxima página</button><button className="text-link" onClick={() => setAttempt(n => n + 1)}>Atualizar ranking</button></div>
    </>}
  </section>
}
