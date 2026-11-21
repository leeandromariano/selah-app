import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { supabase } from '../lib/supabase'
import { createClaimsRepository } from '../claims/repository'
import type { ClaimAnswerResult, ClaimCard, ClaimStats, ClaimVerdict } from '../claims/repository'
import { BibleReference } from './BibleReference'
import { QuizVerse } from './QuizVerse'
import { Heading } from './UI'

const repository = createClaimsRepository(supabase)
const threshold = 90
type Phase = 'intro' | 'loading' | 'playing' | 'done'
const verdictLabels: Record<ClaimVerdict, { title: string; hint: string }> = {
  biblia: { title: 'Tá na Bíblia', hint: 'A frase está nas Escrituras.' },
  distorcida: { title: 'Tá distorcido', hint: 'Existe um texto parecido, mas a frase foi mudada ou mal interpretada.' },
  invencao: { title: 'Tá amarrado', hint: 'Não é da Bíblia: é invenção ou ditado popular.' },
}

export function ClaimsGame() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [cards, setCards] = useState<ClaimCard[]>([])
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<ClaimAnswerResult | null>(null)
  const [choice, setChoice] = useState<boolean | null>(null)
  const [hits, setHits] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<ClaimStats | null>(null)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const origin = useRef<number | null>(null)

  async function start() {
    setError(''); setPhase('loading')
    try {
      const list = await repository.start(5)
      if (!list.length) { setError('Ainda não há cartas disponíveis.'); setPhase('intro'); return }
      setCards(list); setIndex(0); setResult(null); setChoice(null); setHits(0); setDrag(0); setPhase('playing')
    } catch { setError('Não foi possível carregar as cartas. Verifique sua conexão e tente novamente.'); setPhase('intro') }
  }
  async function decide(saidInBible: boolean) {
    const card = cards[index]
    if (busy || result || !card) return
    setBusy(true); setError(''); setChoice(saidInBible)
    try {
      const answer = await repository.answer(card.id, saidInBible)
      setResult(answer)
      if (answer.correct) setHits(value => value + 1)
    } catch { setChoice(null); setError('Não foi possível registrar sua resposta. Tente novamente.') }
    finally { setBusy(false); setDrag(0) }
  }
  function next() {
    if (index + 1 < cards.length) { setIndex(index + 1); setResult(null); setChoice(null); return }
    setPhase('done')
    repository.stats().then(setStats).catch(() => setStats(null))
  }
  function leave() { setCards([]); setIndex(0); setResult(null); setChoice(null); setError(''); setDrag(0); setPhase('intro') }

  const locked = busy || Boolean(result)
  function down(event: PointerEvent<HTMLDivElement>) { if (locked) return; origin.current = event.clientX; setDragging(true); event.currentTarget.setPointerCapture?.(event.pointerId) }
  function move(event: PointerEvent<HTMLDivElement>) { if (origin.current !== null) setDrag(event.clientX - origin.current) }
  function up() {
    if (origin.current === null) return
    const distance = drag
    origin.current = null; setDragging(false)
    if (distance > threshold) void decide(true)
    else if (distance < -threshold) void decide(false)
    else setDrag(0)
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') { event.preventDefault(); void decide(true) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); void decide(false) }
  }

  const card = cards[index]
  const lean = result ? (choice ? 1 : -1) * 12 : drag
  const mood = drag > 30 ? 'yes' : drag < -30 ? 'no' : undefined
  return <>
    <a className="text-link" href="#bereia">← Bereia</a>
    <Heading eyebrow="BEREIA · FATO OU MITO" title="Tá na Bíblia ou Tá Amarrado?" description="Será que essa frase está mesmo na Bíblia? Descubra, com o texto real para conferir." />
    {phase === 'intro' && <section className="quiz-step" aria-label="Como funciona">
      {error && <p className="info" role="alert">{error}</p>}
      <ol className="claims-how">
        <li>Você recebe <b>5 cartas</b> com frases que muita gente atribui à Bíblia.</li>
        <li>Arraste a carta para a <b>direita</b> se <b>Tá na Bíblia</b>, ou para a <b>esquerda</b> se <b>Tá amarrado</b>. Os botões também servem.</li>
        <li>Na hora você vê se era fato, texto distorcido ou invenção, com o versículo real.</li>
      </ol>
      <button type="button" className="button primary" onClick={() => void start()}>Começar</button>
    </section>}
    {phase === 'loading' && <p role="status">Embaralhando as cartas…</p>}
    {phase === 'playing' && card && <section className="claims-board" aria-label={`Carta ${index + 1} de ${cards.length}`}>
      <button type="button" className="quiz-close" aria-label="Sair do jogo" title="Sair do jogo" onClick={leave}>×</button>
      <div className="eyebrow">CARTA {index + 1} DE {cards.length}</div>
      <progress aria-label="Progresso do jogo" max={cards.length} value={index + (result ? 1 : 0)} />
      <div className="claims-stage">
        <div className="claims-card" role="group" tabIndex={locked ? -1 : 0} aria-label={`Frase: ${card.statement}. Use as setas esquerda e direita para responder.`}
          data-mood={mood} data-state={result ? (result.correct ? 'correct' : 'wrong') : undefined}
          style={{ transform: `translateX(${lean}px) rotate(${lean / 12}deg)`, transition: dragging ? 'none' : 'transform 0.25s ease' }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
          <p>“{card.statement}”</p>
        </div>
      </div>
      {!result && <div className="claims-actions">
        <button type="button" className="claims-no" disabled={busy} onClick={() => void decide(false)}><span aria-hidden="true">←</span> Tá amarrado</button>
        <button type="button" className="claims-yes" disabled={busy} onClick={() => void decide(true)}>Tá na Bíblia <span aria-hidden="true">→</span></button>
      </div>}
      {error && <p className="info" role="alert">{error}</p>}
      {result && <div className="quiz-feedback" role="status" data-correct={result.correct}>
        <strong>{result.correct ? 'Você acertou! 🎉' : 'Não foi dessa vez.'}</strong>
        <p><span className="claims-badge" data-verdict={result.verdict}>{verdictLabels[result.verdict].title}</span> {verdictLabels[result.verdict].hint}</p>
        <p>{result.explanation}</p>
        {result.reference && <><p>Para conferir: <BibleReference reference={result.reference} /></p><QuizVerse key={card.id} reference={result.reference} /></>}
        {!result.counted && <p className="muted">Você já tinha respondido esta carta antes, então ela não soma pontos de novo.</p>}
        <button type="button" className="button primary" onClick={next}>{index + 1 < cards.length ? 'Próxima carta →' : 'Ver resultado'}</button>
      </div>}
    </section>}
    {phase === 'done' && <section className="quiz-card" aria-label="Resultado do jogo">
      <div className="eyebrow">RODADA CONCLUÍDA</div>
      <h2>Você acertou {hits} de {cards.length}</h2>
      {stats && <p className="muted">No total, você já acertou {stats.correct} de {stats.answered} cartas respondidas ({stats.total_cards} no baralho).</p>}
      <div className="actions"><button type="button" className="button primary" onClick={() => void start()}>Jogar de novo</button><a className="button secondary" href="#bereia">Voltar à Bereia</a></div>
    </section>}
  </>
}
