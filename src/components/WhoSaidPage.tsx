import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { createWhoRepository, whoModes } from '../who/repository'
import type { WhoAnswerResult, WhoCard, WhoMode, WhoStats } from '../who/repository'
import { BibleReference } from './BibleReference'
import { QuizVerse } from './QuizVerse'
import { Heading } from './UI'

const repository = createWhoRepository(supabase)
const letters = ['A', 'B', 'C', 'D']
type Phase = 'choose' | 'loading' | 'playing' | 'done'

export function WhoSaidPage() {
  const [phase, setPhase] = useState<Phase>('choose')
  const [mode, setMode] = useState<WhoMode>('base')
  const [cards, setCards] = useState<WhoCard[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [result, setResult] = useState<WhoAnswerResult | null>(null)
  const [hits, setHits] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<WhoStats | null>(null)

  async function start(next: WhoMode) {
    setMode(next); setError(''); setPhase('loading')
    try {
      const list = await repository.start(next)
      if (!list.length) { setError('Ainda não há frases neste modo.'); setPhase('choose'); return }
      setCards(list); setIndex(0); setSelected(null); setResult(null); setHits(0); setPhase('playing')
    } catch { setError('Não foi possível carregar o jogo. Verifique sua conexão e tente novamente.'); setPhase('choose') }
  }
  async function choose(option: number) {
    const card = cards[index]
    if (busy || result || !card) return
    setBusy(true); setError(''); setSelected(option)
    try {
      const answer = await repository.answer(card.id, option)
      setResult(answer)
      if (answer.correct) setHits(value => value + 1)
    } catch { setSelected(null); setError('Não foi possível registrar sua resposta. Tente novamente.') }
    finally { setBusy(false) }
  }
  function leave() { setCards([]); setIndex(0); setSelected(null); setResult(null); setError(''); setPhase('choose') }
  function next() {
    if (index + 1 < cards.length) { setIndex(index + 1); setSelected(null); setResult(null); return }
    setPhase('done')
    repository.stats().then(setStats).catch(() => setStats(null))
  }

  const card = cards[index]
  const modeName = whoModes.find(item => item.id === mode)?.name
  return <>
    <a className="text-link" href="#bereia">← Bereia</a>
    <Heading eyebrow="BEREIA · CONTEXTO E PERSONAGENS" title="Quem disse isso?" description="Leia a frase e descubra quem a pronunciou, com o contexto e o texto da Bíblia para conferir." />
    {phase === 'choose' && <section className="quiz-step" aria-label="Escolha o modo">
      {error && <p className="info" role="alert">{error}</p>}
      <h2 className="quiz-step-title">Escolha o modo</h2>
      <div className="quiz-modes">{whoModes.map(item => <button key={item.id} type="button" className="quiz-mode" onClick={() => void start(item.id)}><span className="quiz-mode-text"><strong>{item.name}</strong><span>{item.description}</span></span><span className="quiz-mode-go" aria-hidden="true">→</span></button>)}</div>
      <p className="muted">Cada rodada tem até 10 frases, com 4 personagens como opção. Só a primeira resposta a cada frase conta para a sua pontuação.</p>
    </section>}
    {phase === 'loading' && <p role="status">Preparando as frases…</p>}
    {phase === 'playing' && card && <section className="quiz-card" aria-label={`Frase ${index + 1} de ${cards.length}`}>
      <button type="button" className="quiz-close" aria-label="Sair do jogo" title="Sair do jogo" onClick={leave}>×</button>
      <div className="eyebrow">{modeName?.toUpperCase()} · FRASE {index + 1} DE {cards.length}</div>
      <progress aria-label="Progresso do jogo" max={cards.length} value={index + (result ? 1 : 0)} />
      <h2 className="who-quote">“{card.quote}”</h2>
      <p className="muted">Quem disse isso?</p>
      <div className="quiz-options" role="group" aria-label="Alternativas">{card.options.map((text, i) => {
        const state = !result ? undefined : i === result.correct_index ? 'correct' : i === selected ? 'wrong' : undefined
        return <button key={i} type="button" className="quiz-option" data-state={state} disabled={busy || Boolean(result)} aria-pressed={selected === i} onClick={() => void choose(i)}><span className="quiz-letter">{letters[i]}</span>{text}</button>
      })}</div>
      {error && <p className="info" role="alert">{error}</p>}
      {result && <div className="quiz-feedback" role="status" data-correct={result.correct}>
        <strong>{result.correct ? 'Você acertou! 🎉' : 'Não foi dessa vez.'}</strong>
        <p>Quem disse: <b>{card.options[result.correct_index]}</b> · <BibleReference reference={result.reference} /></p>
        <p>{result.context}</p>
        <QuizVerse key={card.id} reference={result.reference} />
        {!result.counted && <p className="muted">Você já tinha respondido esta frase antes, então ela não soma pontos de novo.</p>}
        <button type="button" className="button primary" onClick={next}>{index + 1 < cards.length ? 'Próxima frase →' : 'Ver resultado'}</button>
      </div>}
    </section>}
    {phase === 'done' && <section className="quiz-card" aria-label="Resultado do jogo">
      <div className="eyebrow">RODADA CONCLUÍDA</div>
      <h2>Você acertou {hits} de {cards.length}</h2>
      <p className="muted">{modeName}</p>
      {stats && <p className="muted">No total, você já acertou {stats.correct} de {stats.answered} frases respondidas ({stats.total_cards} no jogo).</p>}
      <div className="actions"><button type="button" className="button primary" onClick={() => void start(mode)}>Jogar de novo</button><button type="button" className="button secondary" onClick={() => setPhase('choose')}>Trocar modo</button></div>
    </section>}
  </>
}
