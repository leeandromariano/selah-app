import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { renderDuelCard } from '../duel/card'
import { createDuelRepository, duelSecondsPerQuestion, duelSizes } from '../duel/repository'
import type { DuelAnswerResult, DuelResult, DuelSize, DuelState, DuelSummary } from '../duel/repository'
import { duelThemeName, duelUrl, inviteMessage, playerName, rival, secondsText, verdict, verdictText, whatsappLink } from '../duel/share'
import { quizLevels, quizModes } from '../quiz/repository'
import type { QuizLevel, QuizMode } from '../quiz/repository'
import { BibleReference } from './BibleReference'
import { Heading } from './UI'

const defaultRepository = createDuelRepository(supabase)
export type DuelRepo = typeof defaultRepository
const letters = ['A', 'B', 'C', 'D']

// ---------- Escolher o desafio ----------
export function DuelHub({ repo = defaultRepository, onCreated = (code: string) => { location.hash = `bereia/duelo/${code}` } }: { repo?: DuelRepo; onCreated?: (code: string) => void }) {
  const [mode, setMode] = useState<QuizMode>('biblia')
  const [level, setLevel] = useState<QuizLevel>(1)
  const [size, setSize] = useState<DuelSize>(5)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recent, setRecent] = useState<DuelSummary[]>([])
  useEffect(() => {
    let active = true
    repo.mine().then(list => { if (active) setRecent(list) }).catch(() => { if (active) setRecent([]) })
    return () => { active = false }
  }, [repo])
  async function create() {
    setBusy(true); setError('')
    try { onCreated(await repo.create(mode, level, size)) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível criar o duelo.'); setBusy(false) }
  }
  return <>
    <a className="text-link" href="#bereia">← Bereia</a>
    <Heading eyebrow="BEREIA · DESAFIE UM AMIGO" title="Duelo Relâmpago" description="Escolha o tema, responda as perguntas contra o relógio e mande o link para um amigo ou para o grupo de jovens. Quem fizer mais pontos vence." />
    <section className="duel-setup" aria-label="Criar desafio">
      <fieldset><legend><span className="quiz-step-number">1</span> Tema</legend>
        <div className="duel-options">{quizModes.map(item => <label key={item.id} className="duel-option" data-checked={mode === item.id}><input type="radio" name="duel-mode" checked={mode === item.id} onChange={() => setMode(item.id)} /><strong>{item.name}</strong></label>)}</div>
      </fieldset>
      <fieldset><legend><span className="quiz-step-number">2</span> Nível</legend>
        <div className="duel-options">{quizLevels.map(item => <label key={item.id} className="duel-option" data-checked={level === item.id}><input type="radio" name="duel-level" checked={level === item.id} onChange={() => setLevel(item.id)} /><strong>{item.name}</strong></label>)}</div>
      </fieldset>
      <fieldset><legend><span className="quiz-step-number">3</span> Tamanho</legend>
        <div className="duel-options">{duelSizes.map(item => <label key={item} className="duel-option" data-checked={size === item}><input type="radio" name="duel-size" checked={size === item} onChange={() => setSize(item)} /><strong>{item} perguntas</strong></label>)}</div>
      </fieldset>
      <p className="muted">Cada pergunta tem {duelSecondsPerQuestion} segundos. Quem acerta mais vence; no empate, quem respondeu mais rápido.</p>
      {error && <p className="info" role="alert">{error}</p>}
      <button type="button" className="button primary" disabled={busy} onClick={() => void create()}>{busy ? 'Criando…' : 'Criar desafio'}</button>
    </section>
    {recent.length > 0 && <section className="duel-recent" aria-label="Meus duelos">
      <h2>Meus duelos</h2>
      <ul>{recent.map(item => <li key={item.code}><a href={`#bereia/duelo/${item.code}`}>
        <strong>{duelThemeName(item.mode, item.level)}</strong>
        <span>{item.is_creator ? 'Criado por você' : item.creator ? `Desafio de @${item.creator}` : 'Desafio de um amigo'} · {item.finished ? `${item.correct} de ${item.size}` : 'em andamento'}</span>
      </a></li>)}</ul>
    </section>}
  </>
}

// ---------- Jogar e ver o placar ----------
type Phase = 'loading' | 'intro' | 'playing' | 'result' | 'error'

export function DuelRoom({ code, repo = defaultRepository }: { code: string; repo?: DuelRepo }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [duel, setDuel] = useState<DuelState | null>(null)
  const [answers, setAnswers] = useState<Record<string, { selected: number; result: DuelAnswerResult | { correct: boolean; correct_index: number; reference: string } }>>({})
  const [index, setIndex] = useState(0)
  const [left, setLeft] = useState(duelSecondsPerQuestion)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<DuelResult | null>(null)
  const startedAt = useRef(0)
  const sending = useRef(false)

  const loadResult = useCallback(async () => {
    setError('')
    try { setResult(await repo.result(code)); setPhase('result') }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível carregar o placar.'); setPhase('result') }
  }, [repo, code])

  useEffect(() => {
    let active = true
    repo.open(code).then(state => {
      if (!active) return
      setDuel(state)
      const map: typeof answers = {}
      for (const a of state.answers) map[a.question_id] = { selected: a.selected, result: { correct: a.correct, correct_index: a.correct_index, reference: a.reference } }
      setAnswers(map)
      const next = state.questions.findIndex(q => !map[q.id])
      setIndex(next === -1 ? state.questions.length : next)
      if (state.finished || next === -1) void loadResult(); else setPhase('intro')
    }).catch((failure: Error) => { if (active) { setError(failure.message); setPhase('error') } })
    return () => { active = false }
  }, [repo, code, loadResult])

  const question = duel?.questions[index]
  const current = question ? answers[question.id] : undefined

  const submit = useCallback(async (selected: number) => {
    if (!duel || !question || sending.current) return
    sending.current = true; setBusy(true); setError('')
    try {
      const outcome = await repo.answer(code, question.id, selected, Date.now() - startedAt.current)
      setAnswers(map => ({ ...map, [question.id]: { selected, result: outcome } }))
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível registrar sua resposta.') }
    finally { sending.current = false; setBusy(false) }
  }, [duel, question, repo, code])

  // Cronômetro da pergunta: ao zerar, a resposta é enviada como "tempo esgotado".
  useEffect(() => {
    if (phase !== 'playing' || !question || current) return
    startedAt.current = Date.now()
    const timer = setInterval(() => {
      const remaining = duelSecondsPerQuestion - (Date.now() - startedAt.current) / 1000
      if (remaining <= 0) { clearInterval(timer); setLeft(0); void submit(-1) } else setLeft(remaining)
    }, 100)
    return () => clearInterval(timer)
  }, [phase, question, current, submit])

  function next() {
    if (!duel) return
    if (index + 1 < duel.questions.length) { setIndex(index + 1); setLeft(duelSecondsPerQuestion); return }
    void loadResult()
  }

  if (phase === 'loading') return <p role="status">Abrindo o duelo…</p>
  if (phase === 'error' || !duel) return <div className="duel-room"><div className="info" role="alert">{error || 'Duelo não encontrado.'}</div><p><a className="button secondary" href="#bereia/duelo">Criar um duelo</a></p></div>
  const theme = duelThemeName(duel.mode, duel.level)
  const heading = <><a className="text-link" href="#bereia/duelo">← Duelos</a><Heading eyebrow="BEREIA · DUELO RELÂMPAGO" title="Duelo Relâmpago" description={theme} /></>

  if (phase === 'intro') return <>{heading}<section className="duel-card" aria-label="Começar o duelo">
    <h2>{duel.is_creator ? 'Seu desafio está pronto' : duel.creator ? `@${duel.creator} te desafiou!` : 'Você foi desafiado!'}</h2>
    <p>{duel.size} perguntas, {duelSecondsPerQuestion} segundos cada. Valem acertos e, no empate, o tempo.</p>
    {duel.is_creator && <p className="muted">Responda primeiro: depois você recebe o link e o card para mandar aos amigos.</p>}
    <button type="button" className="button primary" onClick={() => setPhase('playing')}>{index > 0 ? 'Continuar' : 'Começar'}</button>
  </section></>

  if (phase === 'playing' && question) return <>{heading}<section className="quiz-card duel-card" aria-label={`Pergunta ${index + 1} de ${duel.size}`}>
    <div className="eyebrow">PERGUNTA {index + 1} DE {duel.size}</div>
    <progress aria-label="Tempo restante" max={duelSecondsPerQuestion} value={current ? 0 : left} />
    <p className="duel-clock" role="timer" aria-live="off">{current ? (current.selected === -1 ? 'Tempo esgotado' : '') : `${Math.ceil(left)} s`}</p>
    <h2>{question.prompt}</h2>
    <div className="quiz-options" role="group" aria-label="Alternativas">{question.options.map((text, i) => {
      const state = !current ? undefined : i === current.result.correct_index ? 'correct' : i === current.selected ? 'wrong' : undefined
      return <button key={i} type="button" className="quiz-option" data-state={state} disabled={busy || Boolean(current)} onClick={() => void submit(i)}><span className="quiz-letter">{letters[i]}</span>{text}</button>
    })}</div>
    {error && <p className="info" role="alert">{error}</p>}
    {current && <div className="quiz-feedback" role="status" data-correct={current.result.correct}>
      <strong>{current.result.correct ? 'Você acertou! 🎉' : current.selected === -1 ? 'O tempo acabou.' : 'Não foi dessa vez.'}</strong>
      <p>Resposta: <b>{question.options[current.result.correct_index]}</b> · <BibleReference reference={current.result.reference} /></p>
      <button type="button" className="button primary" onClick={next}>{index + 1 < duel.size ? 'Próxima pergunta →' : 'Ver placar'}</button>
    </div>}
  </section></>

  return <>{heading}<DuelScore result={result} error={error} onRefresh={() => void loadResult()} /></>
}

// ---------- Placar, convite e card ----------
function DuelScore({ result, error, onRefresh }: { result: DuelResult | null; error: string; onRefresh: () => void }) {
  const [note, setNote] = useState('')
  const [rendering, setRendering] = useState(false)
  if (!result) return <section className="duel-card"><p className="info" role="alert">{error || 'Não foi possível carregar o placar.'}</p><button type="button" className="button secondary" onClick={onRefresh}>Tentar de novo</button></section>
  const me = result.players.find(player => player.is_me)
  const other = me ? rival(result.players) : null
  const theme = duelThemeName(result.mode, result.level)
  const url = duelUrl(location.origin, result.code)
  const message = inviteMessage(url, theme, result.size, me?.correct)
  const outcome = me && other ? verdict(me, other) : null

  async function copy() {
    try { await navigator.clipboard.writeText(url); setNote('Link copiado!') } catch { setNote(`Copie o link: ${url}`) }
  }
  async function card() {
    if (!me) return
    setRendering(true); setNote('')
    try {
      const blob = await renderDuelCard({ theme, size: result!.size, me, rival: other, host: location.host })
      const file = new File([blob], 'duelo-bereia.png', { type: 'image/png' })
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: message }); setNote('') }
      else {
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'duelo-bereia.png'; link.click()
        setTimeout(() => URL.revokeObjectURL(link.href), 4000); setNote('Card salvo. É só postar nos Stories!')
      }
    } catch (failure) { if (!(failure instanceof DOMException && failure.name === 'AbortError')) setNote('Não foi possível gerar o card agora.') }
    finally { setRendering(false) }
  }

  return <section className="duel-card" aria-label="Placar do duelo">
    <div className="eyebrow">DUELO CONCLUÍDO</div>
    {me && <h2>{outcome ? verdictText[outcome] : `Você acertou ${me.correct} de ${result.size}`}</h2>}
    {me && other && <div className="duel-versus" aria-label="Comparação">
      <div data-lead={outcome !== 'lose'}>{outcome === 'win' && <img className="duel-trophy" src="/home/duelo-trofeu.webp" alt="Vencedor" width="72" height="72" />}<b>{me.correct}</b><span>de {result.size}</span><strong>Você</strong><small>{secondsText(me.total_ms)}</small></div>
      <img className="duel-vs" src="/home/duelo-vs.webp" alt="contra" width="72" height="72" />
      <div data-lead={outcome === 'lose'}>{outcome === 'lose' && <img className="duel-trophy" src="/home/duelo-trofeu.webp" alt="Vencedor" width="72" height="72" />}<b>{other.correct}</b><span>de {result.size}</span><strong>{playerName(other)}</strong><small>{secondsText(other.total_ms)}</small></div>
    </div>}
    {me && !other && <p className="muted">Você acertou {me.correct} de {result.size} em {secondsText(me.total_ms)}. Ninguém mais terminou ainda: mande o convite!</p>}
    <p className="muted">{theme}{result.waiting > 0 ? ` · ${result.waiting} ${result.waiting === 1 ? 'amigo ainda está jogando' : 'amigos ainda estão jogando'}` : ''}</p>
    <div className="actions">
      <a className="button primary" href={whatsappLink(message)} target="_blank" rel="noopener noreferrer"><img src="/home/duelo-whatsapp.webp" alt="" width="28" height="28" />Desafiar pelo WhatsApp</a>
      <button type="button" className="button secondary" onClick={() => void card()} disabled={rendering}>{rendering ? 'Gerando…' : 'Card para os Stories'}</button>
      <button type="button" className="button secondary" onClick={() => void copy()}>Copiar link</button>
      <button type="button" className="text-link" onClick={onRefresh}>Atualizar placar</button>
    </div>
    {note && <p role="status" className="muted">{note}</p>}
    <h3>Placar</h3>
    <ol className="duel-board">{result.players.map((player, position) => <li key={position} data-me={player.is_me}>
      <span className="duel-pos">{position + 1}º</span><span className="duel-name">{playerName(player)}{player.is_creator ? ' · criador' : ''}</span><span>{player.correct}/{result.size}</span><small>{secondsText(player.total_ms)}</small>
    </li>)}</ol>
    <p className="duel-again"><a className="button secondary" href="#bereia/duelo">Criar outro duelo</a></p>
  </section>
}
