import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { createQuizRepository, quizLevels, quizModes } from '../quiz/repository'
import type { QuizAnswerResult, QuizLevel, QuizMode, QuizQuestion, QuizStats } from '../quiz/repository'
import { BibleReference } from './BibleReference'
import { QuizVerse } from './QuizVerse'
import { Heading } from './UI'

const repository = createQuizRepository(supabase)
const letters = ['A', 'B', 'C', 'D']
type Phase = 'choose' | 'loading' | 'playing' | 'done'

export function QuizPage() {
  const [phase, setPhase] = useState<Phase>('choose')
  const [mode, setMode] = useState<QuizMode>('biblia')
  const [level, setLevel] = useState<QuizLevel>(1)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [result, setResult] = useState<QuizAnswerResult | null>(null)
  const [hits, setHits] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<QuizStats | null>(null)

  async function start(next: QuizMode, nextLevel: QuizLevel = level) {
    setMode(next); setLevel(nextLevel); setError(''); setPhase('loading')
    try {
      const list = await repository.start(next, nextLevel)
      if (!list.length) { setError('Ainda não há perguntas nesta modalidade e nível.'); setPhase('choose'); return }
      setQuestions(list); setIndex(0); setSelected(null); setResult(null); setHits(0); setPhase('playing')
    } catch { setError('Não foi possível carregar o quiz. Verifique sua conexão e tente novamente.'); setPhase('choose') }
  }
  async function choose(option: number) {
    const question = questions[index]
    if (busy || result || !question) return
    setBusy(true); setError(''); setSelected(option)
    try {
      const answer = await repository.answer(question.id, option)
      setResult(answer)
      if (answer.correct) setHits(value => value + 1)
    } catch { setSelected(null); setError('Não foi possível registrar sua resposta. Tente novamente.') }
    finally { setBusy(false) }
  }
  function leave() { setQuestions([]); setIndex(0); setSelected(null); setResult(null); setError(''); setPhase('choose') }
  async function next() {
    if (index + 1 < questions.length) { setIndex(index + 1); setSelected(null); setResult(null); return }
    setPhase('done')
    repository.stats().then(setStats).catch(() => setStats(null))
  }

  const question = questions[index]
  const levelName = quizLevels.find(item => item.id === level)?.name
  const modeName = quizModes.find(item => item.id === mode)?.name
  return <>
    <Heading eyebrow="TESTE SEU CONHECIMENTO" title="Quiz bíblico" description="Responda e descubra na hora se acertou, com a referência bíblica para conferir." />
    {phase === 'choose' && <section aria-label="Escolha a modalidade">
      {error && <p className="info" role="alert">{error}</p>}
      <fieldset className="quiz-levels"><legend>Nível de dificuldade</legend>
        {quizLevels.map(item => <label key={item.id} className="quiz-level" data-checked={level === item.id}><input type="radio" name="quiz-level" checked={level === item.id} onChange={() => setLevel(item.id)} /><strong>{item.name}</strong><span>{item.description}</span></label>)}
      </fieldset>
      <div className="quiz-modes">{quizModes.map(item => <button key={item.id} type="button" className="quiz-mode" onClick={() => void start(item.id, level)}><strong>{item.name}</strong><span>{item.description}</span></button>)}</div>
      <p className="muted">Cada rodada tem até 10 perguntas de múltipla escolha. Só a primeira resposta a cada pergunta conta para a sua pontuação.</p>
    </section>}
    {phase === 'loading' && <p role="status">Preparando as perguntas…</p>}
    {phase === 'playing' && question && <section className="quiz-card" aria-label={`Pergunta ${index + 1} de ${questions.length}`}>
      <button type="button" className="quiz-close" aria-label="Sair do quiz" title="Sair do quiz" onClick={leave}>×</button>
      <div className="eyebrow">{modeName?.toUpperCase()} · {levelName?.toUpperCase()} · PERGUNTA {index + 1} DE {questions.length}</div>
      <progress aria-label="Progresso do quiz" max={questions.length} value={index + (result ? 1 : 0)} />
      <h2>{question.prompt}</h2>
      <div className="quiz-options" role="group" aria-label="Alternativas">{question.options.map((text, i) => {
        const state = !result ? undefined : i === result.correct_index ? 'correct' : i === selected ? 'wrong' : undefined
        return <button key={i} type="button" className="quiz-option" data-state={state} disabled={busy || Boolean(result)} aria-pressed={selected === i} onClick={() => void choose(i)}><span className="quiz-letter">{letters[i]}</span>{text}</button>
      })}</div>
      {error && <p className="info" role="alert">{error}</p>}
      {result && <div className="quiz-feedback" role="status" data-correct={result.correct}>
        <strong>{result.correct ? 'Você acertou! 🎉' : 'Não foi dessa vez.'}</strong>
        <p>Resposta: <b>{question.options[result.correct_index]}</b> · <BibleReference reference={result.reference} /></p>
        <QuizVerse key={question.id} reference={result.reference} />
        {!result.counted && <p className="muted">Você já tinha respondido esta pergunta antes, então ela não soma pontos de novo.</p>}
        <button type="button" className="button primary" onClick={() => void next()}>{index + 1 < questions.length ? 'Próxima pergunta →' : 'Ver resultado'}</button>
      </div>}
    </section>}
    {phase === 'done' && <section className="quiz-card" aria-label="Resultado do quiz">
      <div className="eyebrow">RODADA CONCLUÍDA</div>
      <h2>Você acertou {hits} de {questions.length}</h2>
      <p className="muted">{modeName} · nível {levelName}</p>
      {stats && <p className="muted">No total, você já acertou {stats.correct} de {stats.answered} perguntas respondidas ({stats.total_questions} no banco do quiz).</p>}
      <div className="actions"><button type="button" className="button primary" onClick={() => void start(mode, level)}>Jogar de novo</button><button type="button" className="button secondary" onClick={() => setPhase('choose')}>Trocar modalidade ou nível</button></div>
    </section>}
  </>
}
