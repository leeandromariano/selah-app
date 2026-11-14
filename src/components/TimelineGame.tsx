import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { createTimelineRepository } from '../timeline/repository'
import type { TimelineAnswerResult, TimelinePair, TimelineStats } from '../timeline/repository'
import { BibleReference } from './BibleReference'
import { Heading } from './UI'

const repository = createTimelineRepository(supabase)
type Phase = 'intro' | 'loading' | 'playing' | 'done'

export function TimelineGame() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [pairs, setPairs] = useState<TimelinePair[]>([])
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)
  const [result, setResult] = useState<TimelineAnswerResult | null>(null)
  const [hits, setHits] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<TimelineStats | null>(null)

  async function start() {
    setError(''); setPhase('loading')
    try {
      const list = await repository.start(10)
      if (!list.length) { setError('Ainda não há acontecimentos suficientes para jogar.'); setPhase('intro'); return }
      setPairs(list); setIndex(0); setChosen(null); setResult(null); setHits(0); setPhase('playing')
    } catch { setError('Não foi possível carregar o jogo. Verifique sua conexão e tente novamente.'); setPhase('intro') }
  }
  async function choose(id: string) {
    const pair = pairs[index]
    if (busy || result || !pair) return
    setBusy(true); setError(''); setChosen(id)
    try {
      const answer = await repository.answer(pair.left.id, pair.right.id, id)
      setResult(answer)
      if (answer.correct) setHits(value => value + 1)
    } catch { setChosen(null); setError('Não foi possível registrar sua resposta. Tente novamente.') }
    finally { setBusy(false) }
  }
  function leave() { setPairs([]); setIndex(0); setChosen(null); setResult(null); setError(''); setPhase('intro') }
  function next() {
    if (index + 1 < pairs.length) { setIndex(index + 1); setChosen(null); setResult(null); return }
    setPhase('done')
    repository.stats().then(setStats).catch(() => setStats(null))
  }

  const pair = pairs[index]
  const state = (id: string) => !result ? undefined : id === result.first.id ? 'correct' : id === chosen ? 'wrong' : undefined
  return <>
    <a className="text-link" href="#bereia">← Bereia</a>
    <Heading eyebrow="BEREIA · NOÇÃO DE TEMPO" title="Linha do Tempo" description="Antes ou depois? Toque no acontecimento que veio primeiro na história da Bíblia." />
    {phase === 'intro' && <section className="quiz-step" aria-label="Como funciona">
      {error && <p className="info" role="alert">{error}</p>}
      <ol className="claims-how">
        <li>Você vê <b>dois acontecimentos</b> da Bíblia.</li>
        <li>Toque naquele que aconteceu <b>primeiro</b>.</li>
        <li>Na hora aparece a ordem certa, com a era e a passagem para conferir. Cada rodada tem 10 pares.</li>
      </ol>
      <button type="button" className="button primary" onClick={() => void start()}>Começar</button>
    </section>}
    {phase === 'loading' && <p role="status">Montando a linha do tempo…</p>}
    {phase === 'playing' && pair && <section className="quiz-card" aria-label={`Par ${index + 1} de ${pairs.length}`}>
      <button type="button" className="quiz-close" aria-label="Sair do jogo" title="Sair do jogo" onClick={leave}>×</button>
      <div className="eyebrow">PAR {index + 1} DE {pairs.length}</div>
      <progress aria-label="Progresso do jogo" max={pairs.length} value={index + (result ? 1 : 0)} />
      <h2>O que aconteceu primeiro?</h2>
      <div className="timeline-pair" role="group" aria-label="Acontecimentos">
        {[pair.left, pair.right].map(item => <button key={item.id} type="button" className="quiz-option timeline-card" data-state={state(item.id)} disabled={busy || Boolean(result)} aria-pressed={chosen === item.id} onClick={() => void choose(item.id)}>{item.title}</button>)}
      </div>
      {error && <p className="info" role="alert">{error}</p>}
      {result && <div className="quiz-feedback" role="status" data-correct={result.correct}>
        <strong>{result.correct ? 'Você acertou! 🎉' : 'Não foi dessa vez.'}</strong>
        <ol className="timeline-order" aria-label="Ordem correta">{[result.first, result.second].map((item, i) => <li key={item.id}><span className="timeline-step">{i + 1}º</span><span><b>{item.title}</b><br /><small>{item.era} · <BibleReference reference={item.reference} /></small></span></li>)}</ol>
        {!result.counted && <p className="muted">Você já tinha respondido este par antes, então ele não soma pontos de novo.</p>}
        <button type="button" className="button primary" onClick={next}>{index + 1 < pairs.length ? 'Próximo par →' : 'Ver resultado'}</button>
      </div>}
    </section>}
    {phase === 'done' && <section className="quiz-card" aria-label="Resultado do jogo">
      <div className="eyebrow">RODADA CONCLUÍDA</div>
      <h2>Você acertou {hits} de {pairs.length}</h2>
      {stats && <p className="muted">No total, você já acertou {stats.correct} de {stats.answered} pares respondidos ({stats.total_events} acontecimentos no jogo).</p>}
      <div className="actions"><button type="button" className="button primary" onClick={() => void start()}>Jogar de novo</button><a className="button secondary" href="#bereia">Voltar à Bereia</a></div>
    </section>}
  </>
}
