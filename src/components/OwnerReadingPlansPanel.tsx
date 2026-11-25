import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createOwnerReadingPlansRepository, planStatus } from '../owner/readingPlans'
import type { OwnerPlans } from '../owner/readingPlans'
import { planOrder, plans } from '../reading/plans'
import type { PlanId } from '../reading/plans'

const repository = createOwnerReadingPlansRepository(supabase)
const dateLabel = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`

// Painel OWNER, área Leitores: quem iniciou um plano de leitura bíblica e em que porcentagem está.
export function OwnerReadingPlansPanel() {
  const [search, setSearch] = useState(''), [query, setQuery] = useState('')
  const [plan, setPlan] = useState<PlanId | ''>('')
  const [page, setPage] = useState(0), [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: OwnerPlans; error?: boolean } | null>(null)
  const key = `${query}:${plan}:${page}:${attempt}`
  const pending = result?.key !== key
  const data = !pending ? result?.data : undefined
  useEffect(() => {
    let active = true
    repository.list(query, plan, page).then(data => { if (active) setResult({ key, data }) }).catch(() => { if (active) setResult({ key, error: true }) })
    return () => { active = false }
  }, [query, plan, page, key])
  return <section className="community owner-plans" aria-labelledby="owner-plans-title" aria-busy={pending}>
    <h2 id="owner-plans-title">PLANOS DE LEITURA BÍBLICA</h2>
    <p>Quem iniciou um plano e quanto já marcou como lido. Visível só para o proprietário, para acompanhamento e incentivo.</p>
    {data && <>
      <div className="community-summary"><div className="stat"><p>Leitores em planos</p><strong>{data.readers}</strong><small>{data.enrollments} {data.enrollments === 1 ? 'plano em andamento ou concluído' : 'planos em andamento ou concluídos'}</small></div><div className="stat"><p>Planos concluídos</p><strong>{data.finished}</strong><small>Com todos os dias marcados</small></div></div>
      {data.plans.length > 0 && <ul className="owner-plans-summary">{data.plans.map(item => <li key={item.plan}><b>{plans[item.plan].short}</b><span>{item.enrolled} {item.enrolled === 1 ? 'leitor' : 'leitores'} · média de {item.average_percent}%</span></li>)}</ul>}
    </>}
    <form className="community-search" onSubmit={e => { e.preventDefault(); setQuery(search); setPage(0); setAttempt(n => n + 1) }}>
      <label>Buscar leitor no plano<input maxLength={25} value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label>Plano<select value={plan} onChange={e => { setPlan(e.target.value as PlanId | ''); setPage(0) }}><option value="">Todos os planos</option>{planOrder.map(id => <option key={id} value={id}>{plans[id].short}</option>)}</select></label>
      <button className="button secondary">Buscar nos planos</button>
    </form>
    {pending && <p role="status">Carregando planos de leitura…</p>}
    {!pending && result?.error && <div className="info" role="alert">Não foi possível consultar os planos de leitura. Verifique sua sessão e tente novamente. <button className="button secondary" onClick={() => setAttempt(n => n + 1)}>Repetir consulta dos planos</button></div>}
    {data && <>
      {!data.items.length ? <p role="status">Nenhum leitor em plano de leitura com esse filtro.</p> : <div className="community-table" tabIndex={0} role="region" aria-label="Leitores nos planos de leitura com rolagem horizontal"><table>
        <caption>Do maior para o menor avanço.</caption>
        <thead><tr>{['Username', 'Plano', 'Andamento', 'Dias lidos', 'Situação', 'Início', 'Última atividade'].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead>
        <tbody>{data.items.map(item => <tr key={`${item.username}:${item.plan}:${item.started_on}`}>
          <th scope="row">{item.username ? '@' + item.username : 'Conta legada sem username'}</th>
          <td>{plans[item.plan].short}</td>
          <td><span className="owner-plans-progress"><i aria-hidden="true" style={{ ['--fill' as string]: item.percent / 100 }} /><strong>{item.percent}%</strong></span></td>
          <td>{item.done_days} de {item.total_days}</td>
          <td><span className="community-status">{planStatus(item, data.server_today)}</span></td>
          <td>{dateLabel(item.started_on)}</td>
          <td>{dateLabel(item.updated_on)}</td>
        </tr>)}</tbody>
      </table></div>}
      <div className="actions community-pagination"><button className="button secondary" disabled={page === 0} onClick={() => setPage(n => n - 1)}>Planos: página anterior</button><span>Página {page + 1} de {Math.max(1, Math.ceil(data.matched / data.size))}</span><button className="button secondary" disabled={(page + 1) * data.size >= data.matched} onClick={() => setPage(n => n + 1)}>Planos: próxima página</button></div>
    </>}
  </section>
}
