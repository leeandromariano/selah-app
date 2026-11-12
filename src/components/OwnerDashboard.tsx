import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createOwnerDashboardRepository, gameNames, periods } from '../owner/dashboard'
import type { Dashboard, Period } from '../owner/dashboard'
import { levelNames } from '../owner/content'
import { BereiaRankingPanel } from './BereiaRankingPanel'
import { Bars, Card, Donut, HBars, KpiCard, Lines, Ring } from './DashboardCharts'
import { number, palette, percent } from '../owner/format'
import { modeForPage, modes } from '../owner/modes'
import { CommunityPanel } from './CommunityPanel'
import { ModerationPanel } from './ModerationPanel'
import { OwnerContentPanel } from './OwnerContentPanel'
import { PublisherManagement } from './PublisherManagement'

const defaultRepository = createOwnerDashboardRepository(supabase)
const dateLabel = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

function Overview({ d }: { d: Dashboard }) {
  const { readers: r, reading: g, games, community: c } = d
  const answers = sum(games.per_game.map(item => item.answers)), days = g.daily_completions.map(item => item.day)
  return <>
    <div className="dash-kpis">
      <KpiCard tone={0} label="Leitores" value={number(r.total)} hint={`+${number(r.new_in_period)} no período`} />
      <KpiCard tone={1} label="Ativos no período" value={number(r.active_in_period)} hint={`${percent(r.active_in_period, r.total)}% dos leitores`} />
      <KpiCard tone={2} label="Devocionais concluídos" value={number(g.completions)} hint={`${number(r.completed_today)} leitores concluíram hoje`} />
      <KpiCard tone={3} label="Respostas nos jogos" value={number(answers)} hint={`${number(games.players)} jogadores`} />
      <KpiCard tone={4} alert={c.pending + c.open_reports > 0} label="Para moderar" value={number(c.pending + c.open_reports)} hint={`${number(c.pending)} reflexões · ${number(c.open_reports)} denúncias`} />
    </div>
    <div className="dash-grid">
      <Card title="Atividade por dia" wide note="Conclusões, aberturas de devocionais e jogos">
        <Lines label="Atividade por dia" days={days} series={[
          { name: 'Conclusões', color: palette[0], values: g.daily_completions.map(item => item.n) },
          { name: 'Aberturas', color: palette[1], values: g.daily_views.map(item => item.n) },
          { name: 'Jogos', color: palette[2], values: games.daily.map(item => item.n) }]} />
      </Card>
      <Card title="Jogos por volume de respostas"><Donut label="Respostas por jogo" items={games.per_game.map(item => ({ label: gameNames[item.id], value: item.answers }))} /></Card>
      <Card title="Engajamento">
        <div className="dash-rings">
          <Ring label="Leitores ativos" part={r.active_in_period} total={r.total} color={palette[1]} />
          <Ring label="Leitores que jogaram" part={games.players} total={r.total} color={palette[2]} />
        </div>
      </Card>
      <Card title="Devocionais mais lidos no período" wide>
        {g.top.length ? <table className="dash-table"><thead><tr><th scope="col">Devocional</th><th scope="col">Aberturas</th><th scope="col">Conclusões</th></tr></thead>
          <tbody>{g.top.map(item => <tr key={item.title}><th scope="row">{item.title}</th><td>{number(item.views)}</td><td>{number(item.completions)}</td></tr>)}</tbody></table> : <p className="muted">Nenhum devocional publicado ainda.</p>}
      </Card>
    </div>
  </>
}

function Readers({ d }: { d: Dashboard }) {
  const { readers: r } = d
  return <>
    <div className="dash-kpis">
      <KpiCard tone={0} label="Leitores cadastrados" value={number(r.total)} />
      <KpiCard tone={1} label="Novos no período" value={number(r.new_in_period)} hint={`${percent(r.new_in_period, r.total)}% da base`} />
      <KpiCard tone={2} label="Ativos no período" value={number(r.active_in_period)} hint={`${percent(r.active_in_period, r.total)}% dos leitores`} />
      <KpiCard tone={3} label="Concluíram hoje" value={number(r.completed_today)} />
      <KpiCard tone={4} label="Maior sequência" value={`${number(r.best_streak)} dias`} hint="Maior já registrada" />
    </div>
    <div className="dash-grid">
      <Card title="Novos leitores por dia" wide><Bars label="Novos leitores por dia" color={palette[1]} data={r.daily_new.map(item => ({ label: item.day, value: item.n }))} /></Card>
      <Card title="Sequência atual dos leitores"><Donut label="Leitores por sequência atual" items={r.streak_buckets.map(item => ({ label: item.label, value: item.n }))} /></Card>
      <Card title="Participação"><div className="dash-rings"><Ring label="Ativos no período" part={r.active_in_period} total={r.total} color={palette[2]} /><Ring label="Concluíram hoje" part={r.completed_today} total={r.total} color={palette[0]} /></div></Card>
    </div>
  </>
}

function Bereia({ d }: { d: Dashboard }) {
  const { games, readers } = d
  const played = games.per_game.filter(item => item.id !== 'verse')
  const answers = sum(games.per_game.map(item => item.answers)), correct = sum(games.per_game.map(item => item.correct))
  const top = [...games.per_game].sort((a, b) => b.answers - a.answers)[0]
  return <>
    <div className="dash-kpis">
      <KpiCard tone={0} label="Jogadores" value={number(games.players)} hint={`${percent(games.players, readers.total)}% dos leitores`} />
      <KpiCard tone={1} label="Respostas e tentativas" value={number(answers)} />
      <KpiCard tone={2} label="Aproveitamento" value={`${percent(correct, answers)}%`} hint="Acertos e desafios resolvidos" />
      <KpiCard tone={3} label="Jogo mais jogado" value={top && top.answers > 0 ? gameNames[top.id] : '—'} hint={top && top.answers > 0 ? `${number(top.answers)} no período` : 'Sem jogadas no período'} />
    </div>
    <div className="dash-grid">
      <Card title="Jogadas por dia" wide><Bars label="Jogadas por dia" color={palette[2]} data={games.daily.map(item => ({ label: item.day, value: item.n }))} /></Card>
      <Card title="Jogadores por jogo"><HBars label="Jogadores por jogo" color={palette[1]} items={games.per_game.map(item => ({ label: gameNames[item.id], value: item.players }))} /></Card>
      <Card title="Aproveitamento por jogo" wide>
        <div className="dash-rings">{[...played, ...games.per_game.filter(item => item.id === 'verse')].map((item, index) => <Ring key={item.id} size={96} label={gameNames[item.id]} part={item.correct} total={item.answers} color={palette[index % palette.length]} />)}</div>
        <p className="muted">No Versículo Oculto, conta o dia em que o desafio foi resolvido.</p>
      </Card>
    </div>
  </>
}

function Reflections({ d }: { d: Dashboard }) {
  const { community: c } = d
  return <>
    <div className="dash-kpis">
      <KpiCard tone={0} label="Reflexões aprovadas" value={number(c.approved)} />
      <KpiCard tone={1} label="Novas no período" value={number(c.approved_in_period)} />
      <KpiCard tone={3} alert={c.pending > 0} label="Pendentes" value={number(c.pending)} hint="Aguardando moderação" />
      <KpiCard tone={4} alert={c.open_reports > 0} label="Denúncias abertas" value={number(c.open_reports)} />
      <KpiCard tone={2} label="Reações" value={number(c.reactions)} hint="Total acumulado" />
    </div>
    <div className="dash-grid">
      <Card title="Reflexões aprovadas por dia" wide><Bars label="Reflexões aprovadas por dia" color={palette[0]} data={c.daily_comments.map(item => ({ label: item.day, value: item.n }))} /></Card>
      <Card title="Fila e publicadas"><Donut label="Reflexões por situação" items={[{ label: 'Aprovadas', value: c.approved }, { label: 'Pendentes', value: c.pending }]} /></Card>
    </div>
  </>
}

function Content({ d }: { d: Dashboard }) {
  const { content: k, reading: g } = d
  return <>
    <div className="dash-kpis">
      <KpiCard tone={0} label="Perguntas do quiz" value={number(k.quiz)} />
      <KpiCard tone={1} label="Frases (Quem disse isso?)" value={number(k.who)} />
      <KpiCard tone={2} label="Cartas (Tá na Bíblia)" value={number(k.claims)} />
      <KpiCard tone={3} label="Versículos ocultos" value={number(k.verse)} hint="Um por dia, em ciclo" />
      <KpiCard tone={4} label="Acontecimentos" value={number(k.timeline)} hint="Linha do Tempo" />
    </div>
    <div className="dash-grid">
      <Card title="Perguntas do quiz por nível"><HBars label="Perguntas por nível" color={palette[0]} items={k.quiz_levels.map(item => ({ label: levelNames[item.level] ?? `Nível ${item.level}`, value: item.n }))} /></Card>
      <Card title="Devocionais"><Donut label="Devocionais por situação" items={[{ label: 'Publicados', value: g.devotionals.published }, { label: 'Agendados', value: g.devotionals.scheduled }, { label: 'Rascunhos', value: g.devotionals.draft }]} /></Card>
    </div>
  </>
}

export function OwnerDashboard({ page, repo = defaultRepository }: { page: string; repo?: typeof defaultRepository }) {
  const mode = modeForPage(page)
  const [days, setDays] = useState<Period>(30)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: Dashboard; error?: boolean } | null>(null)
  const key = `${days}:${attempt}`
  const data = result?.key === key ? result.data : undefined
  const failed = result?.key === key && result.error
  useEffect(() => {
    let active = true
    repo.load(days).then(data => { if (active) setResult({ key, data }) }).catch(() => { if (active) setResult({ key, error: true }) })
    return () => { active = false }
  }, [repo, days, key])

  return <div className="dash">
    <nav className="dash-rail" aria-label="Áreas do painel">
      <div className="dash-rail-title">PAINEL OWNER</div>
      {modes.map(item => <a key={item.id} className="dash-rail-link" href={`#${item.route}`} aria-current={mode === item.id ? 'page' : undefined}><b>{item.label}</b><small>{item.hint}</small></a>)}
      <div className="dash-rail-title dash-rail-shortcuts">ATALHOS</div>
      <a className="dash-rail-link dash-rail-short" href="#admin">Gerenciar devocionais</a>
      <a className="dash-rail-link dash-rail-short" href="#owner/publicadores" aria-current={page === 'owner/publicadores' ? 'page' : undefined}>Publicadores</a>
    </nav>
    <div className="dash-main">
      <div className="dash-head">
        <div><div className="eyebrow">CUIDANDO DA COMUNIDADE</div><h1>Painel OWNER</h1></div>
        <div className="dash-controls">
          <div role="group" aria-label="Período" className="dash-seg">{periods.map(item => <button key={item.days} type="button" aria-pressed={days === item.days} onClick={() => setDays(item.days)}>{item.label}</button>)}</div>
          <button type="button" className="button secondary" onClick={() => setAttempt(n => n + 1)}>Atualizar</button>
        </div>
      </div>
      {data && <p className="muted dash-asof">Dados até {dateLabel(data.server_today)} · últimos {data.days} dias · horário de Brasília</p>}
      {!data && !failed && <p role="status">Carregando indicadores…</p>}
      {failed && <div className="info" role="alert">Não foi possível carregar os indicadores. Acesso exclusivo do proprietário; verifique sua sessão e tente novamente. <button type="button" className="button secondary" onClick={() => setAttempt(n => n + 1)}>Repetir consulta</button></div>}
      {data && <div className="dash-body" data-mode={mode}>
        {mode === 'geral' && <Overview d={data} />}
        {mode === 'leitores' && <Readers d={data} />}
        {mode === 'bereia' && <Bereia d={data} />}
        {mode === 'reflexoes' && <Reflections d={data} />}
        {mode === 'conteudo' && <Content d={data} />}
      </div>}
      <div className="dash-detail">
        {mode === 'leitores' && <CommunityPanel />}
        {mode === 'bereia' && <BereiaRankingPanel />}
        {mode === 'reflexoes' && <ModerationPanel />}
        {mode === 'conteudo' && <>
          <div className="actions dash-subnav">
            <a className="button secondary" href="#owner/perguntas" aria-current={page === 'owner/perguntas' ? 'page' : undefined}>Perguntas dos jogos</a>
            <a className="button secondary" href="#owner/publicadores" aria-current={page === 'owner/publicadores' ? 'page' : undefined}>Gerenciar publicadores</a>
          </div>
          {page === 'owner/publicadores' ? <PublisherManagement /> : <OwnerContentPanel />}
        </>}
      </div>
    </div>
  </div>
}
