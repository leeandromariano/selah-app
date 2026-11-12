import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { changesAnswers, contentGames, createOwnerContentRepository, draftFromItem, emptyDraft, levelNames, validateDraft } from '../owner/content'
import type { ContentDraft, ContentGame, ContentItem, ContentList } from '../owner/content'

const repository = createOwnerContentRepository(supabase)
const letters = ['A', 'B', 'C', 'D']
type Repository = typeof repository
const message = (error: unknown) => (error as { code?: string })?.code === '22023' && (error as Error).message ? (error as Error).message : 'Não foi possível concluir. Acesso exclusivo do proprietário; verifique sua sessão e tente novamente.'

function ContentEditor({ game, original, repo, onSaved, onCancel }: { game: ContentGame; original: ContentItem | null; repo: Repository; onSaved: (note: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<ContentDraft>(() => original ? draftFromItem(original) : emptyDraft(game))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ack, setAck] = useState(false)
  const set = <K extends keyof ContentDraft>(key: K, value: ContentDraft[K]) => setDraft(current => ({ ...current, [key]: value }))
  const setOption = (index: number, value: string) => setDraft(current => ({ ...current, options: current.options.map((option, i) => i === index ? value : option) }))
  const resets = changesAnswers(original, draft) && (original?.answers_count ?? 0) > 0
  const label = contentGames.find(item => item.id === game)!.promptLabel
  const correctText = draft.options[draft.correct_index]?.trim()

  async function submit(event: FormEvent) {
    event.preventDefault()
    const problem = validateDraft(game, draft)
    if (problem) { setError(problem); return }
    if (resets && !ack) { setError('Confirme que as respostas já dadas serão zeradas.'); return }
    setBusy(true); setError('')
    try {
      const saved = await repo.save(game, original?.id ?? null, draft)
      onSaved(saved.answers_reset > 0 ? `Salvo. ${saved.answers_reset} respostas de leitores a esta pergunta foram zeradas.` : 'Salvo.')
    } catch (failure) { setError(message(failure)) }
    finally { setBusy(false) }
  }

  return <form className="owner-editor" onSubmit={event => void submit(event)} aria-label={original ? 'Editar' : 'Nova'}>
    <h3>{original ? `Editar ${label.toLowerCase()}` : `Nova ${label.toLowerCase()}`}</h3>
    <label>{label}<textarea rows={3} maxLength={game === 'quiz' ? 400 : 300} value={draft.prompt} onChange={event => set('prompt', event.target.value)} /></label>
    <fieldset className="owner-options">
      <legend>Alternativas (marque a resposta certa)</legend>
      {draft.options.map((option, i) => <div key={i} className="owner-option" data-correct={draft.correct_index === i}>
        <input type="radio" name="correct" aria-label={`Marcar a alternativa ${letters[i]} como resposta certa`} checked={draft.correct_index === i} onChange={() => set('correct_index', i)} />
        <label>Alternativa {letters[i]}<input value={option} maxLength={120} onChange={event => setOption(i, event.target.value)} /></label>
      </div>)}
      <p className="owner-correct" role="status">Resposta certa: <b>{correctText ? `${letters[draft.correct_index]} — ${correctText}` : `${letters[draft.correct_index]} (ainda sem texto)`}</b></p>
    </fieldset>
    <label>Referência bíblica<input value={draft.reference} maxLength={60} placeholder="Ex.: João 3:16" onChange={event => set('reference', event.target.value)} /></label>
    {game === 'quiz' ? <div className="owner-row">
      <label>Testamento<select value={draft.testament} onChange={event => set('testament', event.target.value as ContentDraft['testament'])}><option value="antigo">Antigo Testamento</option><option value="novo">Novo Testamento</option></select></label>
      <label>Nível<select value={draft.level} onChange={event => set('level', Number(event.target.value) as ContentDraft['level'])}>{[1, 2, 3, 4].map(level => <option key={level} value={level}>{levelNames[level]}</option>)}</select></label>
    </div> : <>
      <label>Modo<select value={draft.mode} onChange={event => set('mode', event.target.value as ContentDraft['mode'])}><option value="base">Modo Base</option><option value="profundo">Modo Profundo</option></select></label>
      <label>Contexto (aparece depois da resposta)<textarea rows={3} maxLength={500} value={draft.context} onChange={event => set('context', event.target.value)} /></label>
    </>}
    <label className="owner-check"><input type="checkbox" checked={draft.active} onChange={event => set('active', event.target.checked)} /> Ativa (aparece para os leitores)</label>
    {resets && <label className="owner-check owner-warning"><input type="checkbox" checked={ack} onChange={event => setAck(event.target.checked)} /> Mudar as alternativas ou a resposta certa zera as {original?.answers_count} respostas já dadas a esta pergunta, para o ranking não guardar acertos de uma versão antiga. Entendo e quero continuar.</label>}
    {error && <p className="info" role="alert">{error}</p>}
    <div className="actions"><button type="submit" className="button primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button><button type="button" className="button secondary" onClick={onCancel}>Cancelar</button></div>
  </form>
}

export function OwnerContentPanel({ repo = repository }: { repo?: Repository }) {
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
  useEffect(() => {
    let active = true
    repo.list(game, query, filter, page).then(data => { if (active) setResult({ key, data }) }).catch(() => {
      if (active) setResult({ key, error: 'Não foi possível carregar as perguntas. Acesso exclusivo do proprietário; verifique sua sessão e tente novamente.' })
    })
    return () => { active = false }
  }, [repo, game, filter, query, page, key])
  const reload = () => setAttempt(n => n + 1)
  const switchGame = (next: ContentGame) => { setGame(next); setFilter(''); setSearch(''); setQuery(''); setPage(0); setEditor(null); setRemoving(null); setNote('') }
  async function confirmRemove(item: ContentItem) {
    try {
      const removed = await repo.remove(game, item.id)
      setNote(removed.answers_removed > 0 ? `Excluída. ${removed.answers_removed} respostas de leitores a ela também foram apagadas.` : 'Excluída.')
      setRemoving(null); reload()
    } catch (failure) { setNote(message(failure)); setRemoving(null) }
  }

  return <section className="community" aria-labelledby="owner-content-title">
    <h2 id="owner-content-title">PERGUNTAS DOS JOGOS</h2>
    <p>Adicione, edite ou remova perguntas e alternativas. Cada pergunta tem uma única resposta certa, marcada ao lado da alternativa: se você trocar o texto, a marcação acompanha a alternativa. Mudar as alternativas ou a resposta zera as respostas já dadas àquela pergunta.</p>
    <div className="actions" role="group" aria-label="Escolha o jogo">{contentGames.map(item => <button key={item.id} type="button" className="button secondary" aria-pressed={game === item.id} onClick={() => switchGame(item.id)}>{item.name}</button>)}</div>
    {note && <p className="info" role="status">{note}</p>}
    {editor ? <ContentEditor key={editor.original?.id ?? 'new'} game={game} original={editor.original} repo={repo} onCancel={() => setEditor(null)} onSaved={saved => { setEditor(null); setNote(saved); reload() }} /> : <>
      <form className="community-search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setPage(0) }}>
        <label>Buscar no texto<input maxLength={60} value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label>{game === 'quiz' ? 'Nível' : 'Modo'}<select value={filter} onChange={event => { setFilter(event.target.value); setPage(0) }}>
          <option value="">Todos</option>
          {game === 'quiz' ? [1, 2, 3, 4].map(level => <option key={level} value={String(level)}>{levelNames[level]}</option>) : <><option value="base">Modo Base</option><option value="profundo">Modo Profundo</option></>}
        </select></label>
        <button className="button secondary">Buscar</button>
        <button type="button" className="button primary" onClick={() => { setNote(''); setEditor({ original: null }) }}>{game === 'quiz' ? 'Nova pergunta' : 'Nova frase'}</button>
      </form>
      {pending && <p role="status">Carregando…</p>}
      {!pending && result?.error && <div className="info" role="alert">{result.error} <button className="button secondary" onClick={reload}>Repetir consulta</button></div>}
      {data && <>
        <p className="muted">{data.total} {data.total === 1 ? 'item' : 'itens'}</p>
        {!data.items.length ? <p role="status">Nada encontrado.</p> : <ul className="owner-list" aria-label="Perguntas">{data.items.map(item => <li key={item.id} data-active={item.active}>
          <div>
            <strong>{item.prompt}</strong>
            <ol className="owner-answers" type="A">{item.options.map((option, i) => <li key={i} data-correct={i === item.correct_index}>{option}{i === item.correct_index && <span className="sr-only"> (resposta certa)</span>}</li>)}</ol>
            <small>{item.game === 'quiz' ? `${levelNames[item.level ?? 1]} · ${item.testament === 'antigo' ? 'Antigo' : 'Novo'} Testamento` : item.mode === 'profundo' ? 'Modo Profundo' : 'Modo Base'} · {item.reference} · {item.active ? 'Ativa' : 'Inativa'} · {item.answers_count} respostas</small>
          </div>
          {removing?.id === item.id ? <div className="owner-confirm" role="alert">Excluir definitivamente? {item.answers_count > 0 ? `As ${item.answers_count} respostas de leitores a ela também serão apagadas.` : 'Nenhum leitor respondeu a ela.'}
            <div className="actions"><button type="button" className="button primary" onClick={() => void confirmRemove(item)}>Sim, excluir</button><button type="button" className="button secondary" onClick={() => setRemoving(null)}>Cancelar</button></div></div>
            : <div className="actions"><button type="button" className="button secondary" onClick={() => { setNote(''); setEditor({ original: item }) }} aria-label={`Editar: ${item.prompt}`}>Editar</button><button type="button" className="button secondary" onClick={() => setRemoving(item)} aria-label={`Excluir: ${item.prompt}`}>Excluir</button></div>}
        </li>)}</ul>}
        <div className="actions community-pagination"><button className="button secondary" disabled={page === 0} onClick={() => setPage(n => n - 1)}>Página anterior</button><span>Página {page + 1}</span><button className="button secondary" disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(n => n + 1)}>Próxima página</button></div>
      </>}
    </>}
  </section>
}
