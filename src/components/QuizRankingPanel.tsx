import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createQuizRepository } from '../quiz/repository'
import type { QuizRanking } from '../quiz/repository'

const repository = createQuizRepository(supabase)

export function QuizRankingPanel() {
  const [search, setSearch] = useState(''), [query, setQuery] = useState('')
  const [page, setPage] = useState(0), [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: QuizRanking; error?: string } | null>(null)
  const key = `${query}:${page}:${attempt}`
  const pending = result?.key !== key
  const data = !pending ? result?.data : undefined
  useEffect(() => {
    let active = true
    repository.ranking(query, page).then(data => { if (active) setResult({ key, data }) }).catch(() => {
      if (active) setResult({ key, error: 'Não foi possível consultar o ranking do quiz. Acesso exclusivo do proprietário; verifique sua sessão e tente novamente.' })
    })
    return () => { active = false }
  }, [query, page, key])
  return <section className="community" aria-labelledby="quiz-ranking-title" aria-busy={pending}>
    <h2 id="quiz-ranking-title">RANKING DO QUIZ BÍBLICO</h2>
    <p>Ranking administrativo exclusivo do proprietário, ordenado por acertos. Conta só a primeira resposta de cada leitor a cada pergunta; serve para acompanhar e incentivar, não para medir fé.</p>
    {data && <div className="community-summary"><div className="stat"><p>Participantes</p><strong>{data.total_players}</strong><small>Leitores que já responderam ao quiz</small></div><div className="stat"><p>Perguntas no quiz</p><strong>{data.total_questions}</strong><small>Banco ativo de perguntas</small></div></div>}
    <form className="community-search" onSubmit={e => { e.preventDefault(); setQuery(search); setPage(0); setAttempt(n => n + 1) }}>
      <label>Buscar por username<input maxLength={25} value={search} onChange={e => setSearch(e.target.value)} /></label>
      <button className="button secondary">Buscar participantes</button>
    </form>
    {pending && <p role="status">Carregando ranking…</p>}
    {!pending && result?.error && <div className="info" role="alert">{result.error} <button className="button secondary" onClick={() => setAttempt(n => n + 1)}>Repetir consulta</button></div>}
    {data && <>
      {!data.players.length ? <p role="status">Nenhum participante encontrado.</p> : <div className="community-table" tabIndex={0} role="region" aria-label="Ranking do quiz com rolagem horizontal"><table>
        <caption>Ranking por acertos, em ordem decrescente.</caption>
        <thead><tr>{['Posição', 'Username', 'Acertos', 'Respondidas', 'Aproveitamento', 'Antigo Testamento', 'Novo Testamento'].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead>
        <tbody>{data.players.map((p, i) => <tr key={`${page}:${i}`}><td>{page * data.size + i + 1}º</td><th scope="row">{p.username ? '@' + p.username : 'Conta legada sem username'}</th><td><strong className="community-streak">{p.correct}</strong></td><td>{p.answered}</td><td>{p.accuracy}%</td><td>{p.antigo_correct}</td><td>{p.novo_correct}</td></tr>)}</tbody>
      </table></div>}
      <div className="actions community-pagination"><button className="button secondary" disabled={page === 0} onClick={() => setPage(n => n - 1)}>Página anterior</button><span>Página {page + 1} · {data.matched_players} participantes encontrados</span><button className="button secondary" disabled={(page + 1) * data.size >= data.matched_players} onClick={() => setPage(n => n + 1)}>Próxima página</button></div>
    </>}
  </section>
}
