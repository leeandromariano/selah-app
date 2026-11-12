import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { parseReference } from '../bible/catalog'
import { fetchApiChapter } from '../bible/apiClient'
import { reportBibleView } from '../bible/fums'
import type { ApiChapter } from '../bible/apiChapter'
import type { Location } from '../bible/catalog'
import { changesAnswers, contentGames, createOwnerContentRepository, draftFromItem, emptyDraft, levelNames, validateDraft, verdictNames } from '../owner/content'
import type { ContentDraft, ContentGame, ContentItem, ContentList, Verdict, VerseBlankDraft } from '../owner/content'
import { locateBlanks, normalizeWord, splitToken, tokenize } from '../verse/mask'

const repository = createOwnerContentRepository(supabase)
const letters = ['A', 'B', 'C', 'D']
type Repository = typeof repository
type VerseLoader = (location: Location) => Promise<ApiChapter>
const message = (error: unknown) => (error as { code?: string })?.code === '22023' && (error as Error).message ? (error as Error).message : 'Não foi possível concluir. Acesso exclusivo do proprietário; verifique sua sessão e tente novamente.'
const filters: Partial<Record<ContentGame, { label: string; options: { value: string; label: string }[] }>> = {
  quiz: { label: 'Nível', options: [1, 2, 3, 4].map(level => ({ value: String(level), label: levelNames[level] })) },
  who: { label: 'Modo', options: [{ value: 'base', label: 'Modo Base' }, { value: 'profundo', label: 'Modo Profundo' }] },
  claims: { label: 'Veredito', options: (Object.keys(verdictNames) as Verdict[]).map(value => ({ value, label: verdictNames[value] })) },
}

// Escolha das palavras escondidas clicando no próprio texto do versículo (ARA).
function VersePicker({ reference, blanks, onChange, load, report }: { reference: string; blanks: VerseBlankDraft[]; onChange: (blanks: VerseBlankDraft[]) => void; load: VerseLoader; report: (token: string) => Promise<void> }) {
  const [state, setState] = useState<{ reference: string; tokens?: string[]; error?: boolean } | null>(null)
  const key = reference.trim()
  const target = parseReference(key)
  const valid = Boolean(target?.verse && !target.endVerse)
  const fetchVerse = useCallback(async (current: VerseBlankDraft[]) => {
    const location = parseReference(key)
    if (!location?.verse) return
    try {
      const chapter = await load({ translation: 'ara', book: location.book, chapter: location.chapter })
      await report(chapter.fumsToken)
      const tokens = tokenize(chapter.verses.find(item => item.number === location.verse && item.endNumber === undefined)?.text ?? '')
      if (!tokens.length) throw Error('Versículo não encontrado')
      setState({ reference: key, tokens })
      // Reposiciona as palavras já escolhidas no texto carregado (se a redação bater).
      const located = current.length ? locateBlanks(tokens, current.map(blank => ({ index: blank.index, length: normalizeWord(blank.answer).length, prev: normalizeWord(blank.prev) }))) : null
      if (located) onChange(located.map(position => ({ index: position + 1, answer: splitToken(tokens[position]).core, prev: position > 0 ? splitToken(tokens[position - 1]).core : '' })))
    } catch { setState({ reference: key, error: true }) }
  }, [key, load, report, onChange])
  // Ao abrir um versículo já cadastrado, carrega o texto sozinho (uma vez por referência).
  const autoKey = useRef('')
  useEffect(() => {
    if (!valid || !blanks.length || autoKey.current === key) return
    autoKey.current = key
    void fetchVerse(blanks)
  }, [valid, blanks, key, fetchVerse])

  const current = state?.reference === key ? state : null
  const chosen = new Set(blanks.map(blank => blank.index))
  function toggle(position: number, tokens: string[]) {
    const index = position + 1
    if (chosen.has(index)) { onChange(blanks.filter(blank => blank.index !== index)); return }
    if (blanks.length >= 3) return
    const core = splitToken(tokens[position]).core
    if (!normalizeWord(core)) return
    onChange([...blanks, { index, answer: core, prev: position > 0 ? splitToken(tokens[position - 1]).core : '' }].sort((a, b) => a.index - b.index))
  }
  return <fieldset className="owner-options">
    <legend>Palavras escondidas (2 ou 3)</legend>
    <button type="button" className="button secondary" disabled={!valid} onClick={() => void fetchVerse(blanks)}>Carregar texto do versículo</button>
    {!valid && <p className="muted">Informe a referência de um único versículo para carregar o texto.</p>}
    {current?.error && <p className="info" role="alert">Não foi possível carregar o texto deste versículo agora. As palavras já escolhidas continuam valendo.</p>}
    {current?.tokens && <>
      <p className="muted">Toque nas palavras que o leitor terá de completar.</p>
      <p className="owner-verse" aria-label="Texto do versículo">{current.tokens.map((token, position) => {
        const { before, core, after } = splitToken(token)
        return <span key={position}>{before}<button type="button" className="owner-word" aria-pressed={chosen.has(position + 1)} disabled={!chosen.has(position + 1) && blanks.length >= 3} onClick={() => toggle(position, current.tokens!)}>{core}</button>{after} </span>
      })}</p>
    </>}
    <p className="owner-correct" role="status">Escondidas: <b>{blanks.length ? blanks.map(blank => blank.answer).join(', ') : 'nenhuma ainda'}</b></p>
  </fieldset>
}

function ContentEditor({ game, original, repo, onSaved, onCancel, loadVerse, reportVerse }: { game: ContentGame; original: ContentItem | null; repo: Repository; onSaved: (note: string) => void; onCancel: () => void; loadVerse: VerseLoader; reportVerse: (token: string) => Promise<void> }) {
  const [draft, setDraft] = useState<ContentDraft>(() => original ? draftFromItem(original) : emptyDraft())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ack, setAck] = useState(false)
  const set = <K extends keyof ContentDraft>(key: K, value: ContentDraft[K]) => setDraft(current => ({ ...current, [key]: value }))
  const setBlanks = useCallback((blanks: VerseBlankDraft[]) => setDraft(current => ({ ...current, blanks })), [])
  const setOption = (index: number, value: string) => setDraft(current => ({ ...current, options: current.options.map((option, i) => i === index ? value : option) }))
  const resets = changesAnswers(game, original, draft) && (original?.answers_count ?? 0) > 0
  const label = contentGames.find(item => item.id === game)!.promptLabel
  const correctText = draft.options[draft.correct_index]?.trim()
  const hasOptions = game === 'quiz' || game === 'who'

  async function submit(event: FormEvent) {
    event.preventDefault()
    const problem = validateDraft(game, draft)
    if (problem) { setError(problem); return }
    if (resets && !ack) { setError('Confirme que as respostas já dadas serão zeradas.'); return }
    setBusy(true); setError('')
    try {
      const saved = await repo.save(game, original?.id ?? null, draft)
      onSaved(saved.answers_reset > 0 ? `Salvo. ${saved.answers_reset} respostas de leitores a este item foram zeradas.` : 'Salvo.')
    } catch (failure) { setError(message(failure)) }
    finally { setBusy(false) }
  }

  return <form className="owner-editor" onSubmit={event => void submit(event)} aria-label={original ? 'Editar' : 'Novo'}>
    <h3>{original ? `Editar: ${label.toLowerCase()}` : `Novo: ${label.toLowerCase()}`}</h3>
    {game !== 'verse' && <label>{label}<textarea rows={3} maxLength={game === 'quiz' ? 400 : game === 'timeline' ? 160 : 300} value={draft.prompt} onChange={event => set('prompt', event.target.value)} /></label>}
    {hasOptions && <fieldset className="owner-options">
      <legend>Alternativas (marque a resposta certa)</legend>
      {draft.options.map((option, i) => <div key={i} className="owner-option" data-correct={draft.correct_index === i}>
        <input type="radio" name="correct" aria-label={`Marcar a alternativa ${letters[i]} como resposta certa`} checked={draft.correct_index === i} onChange={() => set('correct_index', i)} />
        <label>Alternativa {letters[i]}<input value={option} maxLength={120} onChange={event => setOption(i, event.target.value)} /></label>
      </div>)}
      <p className="owner-correct" role="status">Resposta certa: <b>{correctText ? `${letters[draft.correct_index]} — ${correctText}` : `${letters[draft.correct_index]} (ainda sem texto)`}</b></p>
    </fieldset>}
    {game === 'claims' && <>
      <label>Veredito<select value={draft.verdict} onChange={event => set('verdict', event.target.value as Verdict)}>{(Object.keys(verdictNames) as Verdict[]).map(value => <option key={value} value={value}>{verdictNames[value]}</option>)}</select></label>
      <label>Explicação (aparece depois da resposta)<textarea rows={3} maxLength={600} value={draft.explanation} onChange={event => set('explanation', event.target.value)} /></label>
    </>}
    {game === 'timeline' && <div className="owner-row">
      <label>Era<input value={draft.era} maxLength={60} placeholder="Ex.: Patriarcas" onChange={event => set('era', event.target.value)} /></label>
      <label>Posição na linha do tempo (1 = mais antigo)<input type="number" min={1} max={999999} value={draft.position} onChange={event => set('position', Number(event.target.value))} /></label>
    </div>}
    <label>{game === 'claims' ? 'Referência bíblica para conferir (opcional)' : game === 'verse' ? 'Referência do versículo' : 'Referência bíblica'}
      <input value={draft.reference} maxLength={60} placeholder="Ex.: João 3:16" onChange={event => setDraft(current => ({ ...current, reference: event.target.value, ...(game === 'verse' && event.target.value.trim() !== current.reference.trim() ? { blanks: [] } : {}) }))} /></label>
    {game === 'verse' && <VersePicker reference={draft.reference} blanks={draft.blanks} onChange={setBlanks} load={loadVerse} report={reportVerse} />}
    {game === 'quiz' && <div className="owner-row">
      <label>Testamento<select value={draft.testament} onChange={event => set('testament', event.target.value as ContentDraft['testament'])}><option value="antigo">Antigo Testamento</option><option value="novo">Novo Testamento</option></select></label>
      <label>Nível<select value={draft.level} onChange={event => set('level', Number(event.target.value) as ContentDraft['level'])}>{[1, 2, 3, 4].map(level => <option key={level} value={level}>{levelNames[level]}</option>)}</select></label>
    </div>}
    {game === 'who' && <>
      <label>Modo<select value={draft.mode} onChange={event => set('mode', event.target.value as ContentDraft['mode'])}><option value="base">Modo Base</option><option value="profundo">Modo Profundo</option></select></label>
      <label>Contexto (aparece depois da resposta)<textarea rows={3} maxLength={500} value={draft.context} onChange={event => set('context', event.target.value)} /></label>
    </>}
    <label className="owner-check"><input type="checkbox" checked={draft.active} onChange={event => set('active', event.target.checked)} /> Ativo (aparece para os leitores)</label>
    {resets && <label className="owner-check owner-warning"><input type="checkbox" checked={ack} onChange={event => setAck(event.target.checked)} /> {game === 'verse'
      ? `Mudar o versículo ou as palavras escondidas zera as tentativas de hoje neste desafio (${original?.answers_count} registradas no total; os dias anteriores ficam como estão). Entendo e quero continuar.`
      : `Esta mudança altera a resposta certa e zera as ${original?.answers_count} respostas já dadas a este item, para o ranking não guardar acertos de uma versão antiga. Entendo e quero continuar.`}</label>}
    {error && <p className="info" role="alert">{error}</p>}
    <div className="actions"><button type="submit" className="button primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button><button type="button" className="button secondary" onClick={onCancel}>Cancelar</button></div>
  </form>
}

function ItemSummary({ item }: { item: ContentItem }) {
  if (item.game === 'quiz' || item.game === 'who') return <>
    <strong>{item.prompt}</strong>
    <ol className="owner-answers" type="A">{(item.options ?? []).map((option, i) => <li key={i} data-correct={i === item.correct_index}>{option}{i === item.correct_index && <span className="sr-only"> (resposta certa)</span>}</li>)}</ol>
    <small>{item.game === 'quiz' ? `${levelNames[item.level ?? 1]} · ${item.testament === 'antigo' ? 'Antigo' : 'Novo'} Testamento` : item.mode === 'profundo' ? 'Modo Profundo' : 'Modo Base'} · {item.reference} · {item.active ? 'Ativa' : 'Inativa'} · {item.answers_count} respostas</small>
  </>
  if (item.game === 'claims') return <>
    <strong>{item.prompt}</strong>
    <p className="owner-line"><span className="claims-badge" data-verdict={item.verdict}>{verdictNames[item.verdict ?? 'biblia']}</span> {item.explanation}</p>
    <small>{item.reference || 'Sem referência'} · {item.active ? 'Ativa' : 'Inativa'} · {item.answers_count} respostas</small>
  </>
  if (item.game === 'timeline') return <>
    <strong>{item.position}º · {item.prompt}</strong>
    <small>{item.era} · {item.reference} · {item.active ? 'Ativo' : 'Inativo'} · {item.answers_count} respostas em pares com ele</small>
  </>
  return <>
    <strong>{item.reference}</strong>
    <p className="owner-line">Palavras escondidas: <b>{(item.blanks ?? []).map(blank => blank.answer).join(', ')}</b></p>
    <small>Ordem {item.seq} · {item.active ? 'Ativo' : 'Inativo'} · {item.answers_count} tentativas registradas</small>
  </>
}

export function OwnerContentPanel({ repo = repository, loadVerse = fetchApiChapter, reportVerse = reportBibleView }: { repo?: Repository; loadVerse?: VerseLoader; reportVerse?: (token: string) => Promise<void> }) {
  const [game, setGame] = useState<ContentGame>('quiz')
  const [filter, setFilter] = useState(''), [search, setSearch] = useState(''), [query, setQuery] = useState('')
  const [page, setPage] = useState(0), [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: ContentList; error?: string } | null>(null)
  const [editor, setEditor] = useState<{ original: ContentItem | null } | null>(null)
  const [removing, setRemoving] = useState<ContentItem | null>(null)
  const [note, setNote] = useState('')
  const key = `${game}:${filter}:${query}:${page}:${attempt}`
  const pending = result?.key !== key
  const data = !pending ? result?.data : undefined
  const info = contentGames.find(item => item.id === game)!
  const gameFilter = filters[game]
  useEffect(() => {
    let active = true
    repo.list(game, query, filter, page).then(data => { if (active) setResult({ key, data }) }).catch(() => {
      if (active) setResult({ key, error: 'Não foi possível carregar o conteúdo. Acesso exclusivo do proprietário; verifique sua sessão e tente novamente.' })
    })
    return () => { active = false }
  }, [repo, game, filter, query, page, key])
  const reload = () => setAttempt(n => n + 1)
  const switchGame = (next: ContentGame) => { setGame(next); setFilter(''); setSearch(''); setQuery(''); setPage(0); setEditor(null); setRemoving(null); setNote('') }
  async function confirmRemove(item: ContentItem) {
    try {
      const removed = await repo.remove(game, item.id)
      setNote(removed.answers_removed > 0 ? `Excluído. ${removed.answers_removed} respostas de leitores a ele também foram apagadas.` : 'Excluído.')
      setRemoving(null); reload()
    } catch (failure) { setNote(message(failure)); setRemoving(null) }
  }

  return <section className="community" aria-labelledby="owner-content-title">
    <h2 id="owner-content-title">CONTEÚDO DOS JOGOS</h2>
    <p>Adicione, edite ou remova o conteúdo de cada jogo. Mudar o que define a resposta certa (alternativas, veredito, posição ou palavras escondidas) zera as respostas já dadas àquele item.</p>
    <div className="actions" role="group" aria-label="Escolha o jogo">{contentGames.map(item => <button key={item.id} type="button" className="button secondary" aria-pressed={game === item.id} onClick={() => switchGame(item.id)}>{item.name}</button>)}</div>
    {note && <p className="info" role="status">{note}</p>}
    {editor ? <ContentEditor key={editor.original?.id ?? 'new'} game={game} original={editor.original} repo={repo} loadVerse={loadVerse} reportVerse={reportVerse} onCancel={() => setEditor(null)} onSaved={saved => { setEditor(null); setNote(saved); reload() }} /> : <>
      <form className="community-search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setPage(0) }}>
        <label>Buscar no texto<input maxLength={60} value={search} onChange={event => setSearch(event.target.value)} /></label>
        {gameFilter && <label>{gameFilter.label}<select value={filter} onChange={event => { setFilter(event.target.value); setPage(0) }}>
          <option value="">Todos</option>
          {gameFilter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>}
        <button className="button secondary">Buscar</button>
        <button type="button" className="button primary" onClick={() => { setNote(''); setEditor({ original: null }) }}>{info.newLabel}</button>
      </form>
      {pending && <p role="status">Carregando…</p>}
      {!pending && result?.error && <div className="info" role="alert">{result.error} <button className="button secondary" onClick={reload}>Repetir consulta</button></div>}
      {data && <>
        <p className="muted">{data.total} {data.total === 1 ? 'item' : 'itens'}</p>
        {!data.items.length ? <p role="status">Nada encontrado.</p> : <ul className="owner-list" aria-label="Itens">{data.items.map(item => <li key={item.id} data-active={item.active}>
          <div><ItemSummary item={item} /></div>
          {removing?.id === item.id ? <div className="owner-confirm" role="alert">Excluir definitivamente? {item.answers_count > 0 ? `As ${item.answers_count} respostas de leitores a ele também serão apagadas.` : 'Nenhum leitor respondeu a ele.'}
            <div className="actions"><button type="button" className="button primary" onClick={() => void confirmRemove(item)}>Sim, excluir</button><button type="button" className="button secondary" onClick={() => setRemoving(null)}>Cancelar</button></div></div>
            : <div className="actions"><button type="button" className="button secondary" onClick={() => { setNote(''); setEditor({ original: item }) }} aria-label={`Editar: ${item.prompt}`}>Editar</button><button type="button" className="button secondary" onClick={() => setRemoving(item)} aria-label={`Excluir: ${item.prompt}`}>Excluir</button></div>}
        </li>)}</ul>}
        <div className="actions community-pagination"><button className="button secondary" disabled={page === 0} onClick={() => setPage(n => n - 1)}>Página anterior</button><span>Página {page + 1} de {Math.max(1, Math.ceil(data.total / data.size))}</span><button className="button secondary" disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(n => n + 1)}>Próxima página</button></div>
      </>}
    </>}
  </section>
}
