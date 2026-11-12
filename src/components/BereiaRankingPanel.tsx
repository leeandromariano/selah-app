import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { bereiaGames, createBereiaRankingRepository } from '../bereia/ranking'
import type { BereiaGame, BereiaPlayer, BereiaRanking } from '../bereia/ranking'
import { QuizRankingPanel } from './QuizRankingPanel'

const repository = createBereiaRankingRepository(supabase)
type Tab = BereiaGame | 'quiz'
const tabs: { id: Tab; name: string }[] = [{ id: 'geral', name: 'Geral' }, { id: 'quiz', name: 'Quiz bíblico' }, ...bereiaGames.filter(item => item.id !== 'geral').map(item => ({ id: item.id, name: item.name }))]
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('pt-BR') : '—'
const columns: Record<BereiaGame, { title: string; cell: (p: BereiaPlayer) => React.ReactNode }[]> = {
  geral: [
    { title: 'Pontos', cell: p => <strong className="community-streak">{p.score}</strong> }, { title: 'Acertos', cell: p => p.correct }, { title: 'Respondidas', cell: p => p.answered },
    { title: 'Versículos resolvidos', cell: p => p.solved }, { title: 'Jogos jogados', cell: p => p.games_played }, { title: 'Última atividade', cell: p => date(p.last_at) },
  ],
  claims: [{ title: 'Acertos', cell: p => <strong className="community-streak">{p.correct}</strong> }, { title: 'Respondidas', cell: p => p.answered }, { title: 'Aproveitamento', cell: p => `${p.accuracy}%` }, { title: 'Última atividade', cell: p => date(p.last_at) }],
  who: [{ title: 'Acertos', cell: p => <strong className="community-streak">{p.correct}</strong> }, { title: 'Respondidas', cell: p => p.answered }, { title: 'Aproveitamento', cell: p => `${p.accuracy}%` }, { title: 'Última atividade', cell: p => date(p.last_at) }],
  timeline: [{ title: 'Acertos', cell: p => <strong className="community-streak">{p.correct}</strong> }, { title: 'Respondidas', cell: p => p.answered }, { title: 'Aproveitamento', cell: p => `${p.accuracy}%` }, { title: 'Última atividade', cell: p => date(p.last_at) }],
  verse: [{ title: 'Dias resolvidos', cell: p => <strong className="community-streak">{p.solved}</strong> }, { title: 'Dias jogados', cell: p => p.played }, { title: 'Média de tentativas', cell: p => p.avg_attempts === null ? '—' : p.avg_attempts.toLocaleString('pt-BR') }, { title: 'Última atividade', cell: p => date(p.last_at) }],
}

function GameRanking({ game }: { game: BereiaGame }) {
  const [search, setSearch] = useState(''), [query, setQuery] = useState('')
  const [page, setPage] = useState(0), [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: BereiaRanking; error?: string } | null>(null)
  const key = `${game}:${query}:${page}:${attempt}`
  const pending = result?.key !== key
  const data = !pending ? result?.data : undefined
  const info = bereiaGames.find(item => item.id === game)!
  useEffect(() => {
    let active = true
    repository.ranking(game, query, page).then(data => { if (active) setResult({ key, data }) }).catch(() => {
      if (active) setResult({ key, error: 'Não foi possível consultar o ranking. Acesso exclusivo do proprietário; verifique sua sessão e tente novamente.' })
    })
    return () => { active = false }
  }, [game, query, page, key])
  return <div aria-busy={pending}>
    <p>{info.description} Conta só a primeira resposta de cada leitor; serve para acompanhar e incentivar, não para medir fé.</p>
    {data && <div className="community-summary"><div className="stat"><p>Participantes</p><strong>{data.total_players}</strong><small>Leitores que já jogaram</small></div>{data.total_items > 0 && <div className="stat"><p>{game === 'verse' ? 'Desafios no banco' : game === 'timeline' ? 'Acontecimentos' : 'Cartas e frases'}</p><strong>{data.total_items}</strong><small>Conteúdo ativo</small></div>}</div>}
    <form className="community-search" onSubmit={e => { e.preventDefault(); setQuery(search); setPage(0); setAttempt(n => n + 1) }}>
      <label>Buscar por username<input maxLength={25} value={search} onChange={e => setSearch(e.target.value)} /></label>
      <button className="button secondary">Buscar participantes</button>
    </form>
    {pending && <p role="status">Carregando ranking…</p>}
    {!pending && result?.error && <div className="info" role="alert">{result.error} <button className="button secondary" onClick={() => setAttempt(n => n + 1)}>Repetir consulta</button></div>}
    {data && <>
      {!data.players.length ? <p role="status">Nenhum participante encontrado.</p> : <div className="community-table" tabIndex={0} role="region" aria-label={`Ranking de ${info.name} com rolagem horizontal`}><table>
        <caption>Ranking de {info.name}, em ordem decrescente.</caption>
        <thead><tr><th scope="col">Posição</th><th scope="col">Username</th>{columns[game].map(column => <th scope="col" key={column.title}>{column.title}</th>)}</tr></thead>
        <tbody>{data.players.map((p, i) => <tr key={`${page}:${i}`}><td>{page * data.size + i + 1}º</td><th scope="row">{p.username ? '@' + p.username : 'Conta legada sem username'}</th>{columns[game].map(column => <td key={column.title}>{column.cell(p)}</td>)}</tr>)}</tbody>
      </table></div>}
      <div className="actions community-pagination"><button className="button secondary" disabled={page === 0} onClick={() => setPage(n => n - 1)}>Página anterior</button><span>Página {page + 1} · {data.matched_players} participantes encontrados</span><button className="button secondary" disabled={(page + 1) * data.size >= data.matched_players} onClick={() => setPage(n => n + 1)}>Próxima página</button></div>
    </>}
  </div>
}

export function BereiaRankingPanel() {
  const [tab, setTab] = useState<Tab>('geral')
  return <section className="community" aria-labelledby="bereia-ranking-title">
    <h2 id="bereia-ranking-title">RANKING DA BEREIA</h2>
    <div className="actions" role="group" aria-label="Escolha o jogo">{tabs.map(item => <button key={item.id} type="button" className="button secondary" aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.name}</button>)}</div>
    {tab === 'quiz' ? <QuizRankingPanel /> : <GameRanking key={tab} game={tab} />}
  </section>
}
