import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { bibleHash, bookById, parseReference } from '../bible/catalog'
import { displayAttribution } from '../bible/attribution'
import { fetchApiChapter } from '../bible/apiClient'
import { reportBibleView } from '../bible/fums'
import type { ApiChapter } from '../bible/apiChapter'
import type { Location } from '../bible/catalog'
import { createVerseRepository } from '../verse/repository'
import type { VerseState } from '../verse/repository'
import { locateBlanks, shareText, splitToken, tokenize } from '../verse/mask'
import { Heading } from './UI'

type Repository = ReturnType<typeof createVerseRepository>
type Props = { repository?: Repository; load?: (location: Location) => Promise<ApiChapter>; report?: (token: string) => Promise<void> }
type Loaded = { state: VerseState; tokens: string[]; positions: number[]; copyright: string }
const defaultRepository = createVerseRepository(supabase)

export function VerseGame({ repository = defaultRepository, load = fetchApiChapter, report = reportBibleView }: Props) {
  const [game, setGame] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [words, setWords] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const start = useCallback(async () => {
    const state = await repository.today()
    const target = parseReference(state.reference)
    if (!target?.verse || target.endVerse) throw Error('Referência inválida')
    const chapter = await load({ translation: 'ara', book: target.book, chapter: target.chapter })
    await report(chapter.fumsToken)
    const verse = chapter.verses.find(item => item.number === target.verse && item.endNumber === undefined)
    const tokens = tokenize(verse?.text ?? '')
    const positions = locateBlanks(tokens, state.blanks)
    if (!positions) throw Error('Texto do versículo indisponível')
    return { state, tokens, positions, copyright: chapter.copyright }
  }, [repository, load, report])

  useEffect(() => {
    let active = true
    start().then(loaded => { if (active) { setGame(loaded); setWords(loaded.state.blanks.map(() => '')); setError('') } })
      .catch(() => { if (active) setError('Não foi possível carregar o versículo de hoje. Verifique sua conexão e tente novamente.') })
    return () => { active = false }
  }, [start, attempt])

  if (!game) return <>
    <a className="text-link" href="#bereia">← Bereia</a>
    <Heading eyebrow="BEREIA · DESAFIO DIÁRIO" title="Versículo Oculto" description="Complete as palavras que faltam no versículo do dia. Você tem 4 tentativas." />
    {error ? <div role="alert" className="info">{error} <button type="button" className="text-link" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Tentar de novo</button></div> : <p role="status">Buscando o versículo do dia…</p>}
  </>

  const current = game
  const { state, tokens, positions } = current
  const solvedBlank = state.blanks.map((_, i) => state.attempts.some(a => a.results[i]))
  const wordAt = (i: number) => splitToken(tokens[positions[i]]).core
  const book = bookById(parseReference(state.reference)?.book ?? '')?.name
  const rows = state.attempts.map(a => a.results)
  const text = shareText(state.number, rows, state.solved, state.max_attempts, `${location.origin}/#bereia/versiculo`)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || state.finished) return
    const guess = state.blanks.map((_, i) => solvedBlank[i] ? wordAt(i) : words[i].trim())
    if (guess.some(word => !word)) { setMessage('Preencha todas as palavras que faltam.'); return }
    setBusy(true); setMessage('')
    try {
      const result = await repository.guess(guess)
      setGame({ ...current, state: result })
      setWords(result.blanks.map(() => ''))
    } catch { setMessage('Não foi possível enviar sua tentativa. Tente novamente.') }
    finally { setBusy(false) }
  }
  async function share() {
    try {
      if (typeof navigator.share === 'function') { await navigator.share({ text }); setMessage(''); return }
      await navigator.clipboard.writeText(text)
      setMessage('Resultado copiado! Cole no WhatsApp ou nos Stories.')
    } catch (failure) {
      if ((failure as Error)?.name === 'AbortError') return
      setMessage('Não foi possível copiar sozinho. Selecione o texto acima e copie.')
    }
  }

  return <>
    <a className="text-link" href="#bereia">← Bereia</a>
    <Heading eyebrow="BEREIA · DESAFIO DIÁRIO" title="Versículo Oculto" description="Complete as palavras que faltam no versículo do dia. Você tem 4 tentativas." />
    <section className="verse-board" aria-label={`Versículo Oculto número ${state.number}`}>
      <div className="verse-meta"><span>#{state.number}</span><span>Livro: {book ?? 'Bíblia'}</span>{state.streak > 0 && <span>🔥 {state.streak} {state.streak === 1 ? 'dia seguido' : 'dias seguidos'}</span>}</div>
      <blockquote className="verse-text" aria-label="Versículo com palavras escondidas">
        {tokens.map((token, position) => {
          const slot = positions.indexOf(position)
          if (slot < 0) return <span key={position}>{token} </span>
          const { before, core, after } = splitToken(token)
          const shown = state.finished || solvedBlank[slot]
          return <span key={position}>{before}{shown
            ? <mark className="verse-word" data-ok={solvedBlank[slot]}>{core}</mark>
            : <span className="verse-blank" role="img" aria-label={`Palavra escondida ${slot + 1}, ${state.blanks[slot].length} letras`}>{'▢'.repeat(Math.min(core.length, 14))}</span>}{after} </span>
        })}
      </blockquote>
      {rows.length > 0 && <ol className="verse-grid" aria-label="Suas tentativas">{rows.map((row, i) => <li key={i} aria-label={`Tentativa ${i + 1}: ${row.filter(Boolean).length} de ${row.length} palavras certas`}>{row.map((ok, j) => <span key={j} aria-hidden="true">{ok ? '🟧' : '⬛'}</span>)}</li>)}</ol>}
      {!state.finished && <form className="verse-form" onSubmit={event => void submit(event)}>
        {state.blanks.map((blank, i) => !solvedBlank[i] && <label key={i}>Palavra {i + 1} <small>({blank.length} letras)</small>
          <input value={words[i] ?? ''} maxLength={40} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={event => setWords(words.map((word, j) => j === i ? event.target.value : word))} />
        </label>)}
        <button type="submit" className="button primary" disabled={busy}>Tentar ({state.attempts.length + 1} de {state.max_attempts})</button>
      </form>}
      {message && <p className="info" role="status">{message}</p>}
      {state.finished && <div className="quiz-feedback" role="status" data-correct={state.solved}>
        <strong>{state.solved ? `Você acertou em ${state.attempts.length} ${state.attempts.length === 1 ? 'tentativa' : 'tentativas'}! 🎉` : 'Não foi dessa vez. As palavras estão reveladas acima.'}</strong>
        <p><a className="text-link" href={bibleHash({ ...(parseReference(state.reference) as Omit<Location, 'translation'>), translation: 'ara' })}>{state.reference}</a> · ARA</p>
        <small>{displayAttribution(current.copyright)}</small>
        <p className="muted">Volte amanhã para o próximo versículo.</p>
        <pre className="verse-share" aria-label="Resultado para compartilhar">{text}</pre>
        <button type="button" className="button primary" onClick={() => void share()}>Compartilhar resultado</button>
      </div>}
    </section>
  </>
}

