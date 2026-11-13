import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/auth'
import { supabase } from '../lib/supabase'
import { createDevotionalRepository, devotionalMessage, displayDate, localDay, publishedToday, toCard } from '../devotionals/repository'
import type { Opening, Publication } from '../devotionals/repository'
import { DevotionalCard, Heading, Icon } from './UI'
import { ConsistencySection } from './ConsistencySection'
import { ReadingProgress } from './ReadingProgress'
import { createReadingRepository } from '../reading/repository'
import type { Completion } from '../reading/repository'
import { ShareDevotional } from './ShareDevotional'
import { PrayerCapsuleForm } from './PrayerCapsuleForm'
import { PrayerDueCards } from './PrayerDueCards'
import { ShareCompletionDialog } from './ShareCompletionDialog'
import { DiscussionSection } from './DiscussionSection'
import { BibleReference } from './BibleReference'
import { DevotionalPassage } from './DevotionalPassage'
import { LegacyDevotionalPassage } from './LegacyDevotionalPassage'
import { ReadingPosition } from './ReadingPosition'
import { GuidedDevotional } from './GuidedDevotional'
import { guidedDevotionalsEnabled } from '../devotionals/guidedFeature'
import { PrivateResponseHistory } from './PrivateResponseHistory'

const repository = createDevotionalRepository(supabase)
const readingRepository = createReadingRepository(supabase)
export function ReaderLibrary({ page, embedded = false }: { page: string; embedded?: boolean }) {
  const { session, loading, recovery } = useAuth()
  if (loading) return <p role="status">Carregando sessão…</p>
  if (!session || recovery) return <div className="info">Entre na sua conta para acessar os devocionais e seu histórico. <a href="#login">Entrar</a></div>
  return <Library key={session.user.id} userId={session.user.id} name={typeof session.user.user_metadata?.name === 'string' ? session.user.user_metadata.name.trim() : ''} page={page} embedded={embedded} />
}

function Library({ userId, name, page, embedded }: { userId: string; name: string; page: string; embedded: boolean }) {
  const [items, setItems] = useState<Publication[]>([])
  const [openings, setOpenings] = useState<Opening[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [completionsError, setCompletionsError] = useState('')
  const [completionsLoading, setCompletionsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [error, setError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [openingError, setOpeningError] = useState('')
  const [opening, setOpening] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [shareOpen, setShareOpen] = useState(false)
  const closeShare = useCallback(() => setShareOpen(false), [])
  const [now, setNow] = useState(() => new Date())
  const [search, setSearch] = useState('')
  const [mood, setMood] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent')
  const active = useRef(false)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  const selectedId = page.startsWith('leitura/') ? page.slice(8).replace(/\/(compartilhar|retomar)$/, '') : ''
  const resumePosition = page.endsWith('/retomar')
  const current = items.find(item => item.id === selectedId)
  useEffect(() => {
    const refresh = () => setNow(new Date())
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])
  useEffect(() => {
    let active = true
    repository.published(now).then(data => { if (active) { setItems(data); setError(''); setLoading(false) } }).catch(error => { if (active) { setError(devotionalMessage(error)); setLoading(false) } })
    return () => { active = false }
  }, [now, attempt])
  useEffect(() => {
    let active = true
    repository.openings(userId).then(data => { if (active) { setOpenings(data); setHistoryError(''); setHistoryLoading(false) } }).catch(error => { if (active) { setHistoryError(devotionalMessage(error)); setHistoryLoading(false) } })
    return () => { active = false }
  }, [userId, attempt])
  useEffect(() => {
    let active = true
    readingRepository.completions(userId).then(data => { if (active) { setCompletions(data); setCompletionsError(''); setCompletionsLoading(false) } }).catch(error => { if (active) { setCompletionsError(devotionalMessage(error)); setCompletionsLoading(false) } })
    return () => { active = false }
  }, [userId, attempt])
  async function open(id: string) {
    // Only an explicit reader action records an opening. Merely loading the list does not.
    if (opening) return
    setOpening(true); setOpeningError('')
    try {
      const event = await repository.open(id)
      if (!active.current) return
      setOpenings(previous => [event, ...previous])
      location.hash = `leitura/${id}`
    } catch (error) { if (active.current) setOpeningError(devotionalMessage(error)) }
    finally { if (active.current) setOpening(false) }
  }
  const retry = <button className="button secondary" onClick={() => { setLoading(true); setHistoryLoading(true); setAttempt(value => value + 1) }}>Tentar novamente</button>
  if (loading) return <p role="status">Carregando devocionais…</p>
  if (error) return <div className="info" role="alert">{error} {retry}</div>
  const today = publishedToday(items, now)
  const previous = items.filter(item => localDay(item.publish_at) < localDay(now))
  const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
  const query = normalizeSearch(search)
  const filtered = items.filter(item => normalizeSearch(`${item.title} ${item.bible_reference}`).includes(query)).sort((a, b) => {
    const order = Date.parse(b.publish_at) - Date.parse(a.publish_at) || b.id.localeCompare(a.id)
    return sortOrder === 'recent' ? order : -order
  })
  const cards = (entries: Publication[]) => <div className="card-grid">{entries.map(item => <DevotionalCard key={item.id} item={toCard(item)} onOpen={open} completed={completions.some(value => value.source_devotional_id === item.id)} />)}</div>
  return <>
    {opening && <p role="status">Registrando abertura…</p>}
    {openingError && <div className="info" role="alert">{openingError} Tente abrir o devocional novamente.</div>}
    {page === 'inicio' && <><div className="greeting"><div><div className="eyebrow">HOJE NA PRESENÇA</div><h1>{name ? `Bem-vindo, ${name}!` : 'Que bom ter você aqui.'}</h1><p>Menos rotina. Mais presença.</p></div><div className="date">{displayDate(now.toISOString())}<small>Horário de Brasília</small></div></div>
      <ConsistencySection userId={userId} refreshKey={attempt} compact />
      <PrayerDueCards key={userId} />
      {today && <section className="mood-checkin" aria-labelledby="mood-heading"><div><div className="eyebrow">ANTES DE COMEÇAR</div><h2 id="mood-heading">Como seu coração chega hoje?</h2><p>Escolha se quiser.</p></div><div className="mood-options">{['Acelerado', 'Em paz', 'Cansado', 'Grato'].map(option => <button key={option} type="button" aria-pressed={mood === option} onClick={() => setMood(option)}>{option}</button>)}</div>{mood && <p className="mood-response" role="status">Você pode entrar na Presença como está.</p>}</section>}
      {today ? <section className="hero"><div className="hero-copy"><div className="eyebrow">● A REAL DO DIA <span>{displayDate(today.publish_at)}</span></div><span className="hero-tag">VIVER CORAM DEO</span>{completions.some(value => value.source_devotional_id === today.id) && <span className="hero-tag">Concluído por você</span>}<h2>{today.title}</h2>{today.author_name?.trim() && <p className="muted">Por {today.author_name.trim()}</p>}<p>{toCard(today).summary}</p><div className="hero-meta"><span><Icon name="book" />{today.bible_reference}</span><span><Icon name="clock" />{toCard(today).minutes} min de leitura estimada</span></div><button className="button white" disabled={opening} onClick={() => open(today.id)}>Entrar na Presença <span>→</span></button></div><div className="hero-brand-art" aria-hidden="true"><span>C</span><i>VIVER<br />CORAM DEO</i></div></section> : <div className="info">Nenhum devocional publicado para hoje.</div>}
      <section className="encouragement"><span className="heart" aria-hidden="true">♡</span><div><h3>Menos rotina. Mais presença.</h3><p>Reserve alguns minutos para cuidar da sua vida com Deus. O seu coração agradece.</p></div><span className="spark" aria-hidden="true">✧</span></section>
      <section><div className="section-heading"><div><div className="eyebrow">CONTINUE SE APROXIMANDO</div><h2>Mais palavras para o seu dia</h2></div><a className="text-link" href="#historico">Ver todos →</a></div>{cards(previous.slice(0, 3))}{!previous.length && <p className="info">Ainda não há publicações anteriores.</p>}</section></>}
    {page === 'historico' && <><Heading eyebrow="PALAVRAS QUE PERMANECEM" title="Seus próximos momentos de fé" description="Explore todos os devocionais publicados, inclusive o de hoje." /><div className="discovery-controls"><label className="discovery-field">Buscar por título ou referência<input type="search" placeholder="Ex.: paz ou João 14" value={search} onChange={e => setSearch(e.target.value)} /></label><label className="discovery-field">Ordenar por<select value={sortOrder} onChange={e => setSortOrder(e.target.value === 'oldest' ? 'oldest' : 'recent')}><option value="recent">Mais recentes</option><option value="oldest">Mais antigos</option></select></label></div><p className="muted result-note" role="status">{filtered.length} {filtered.length === 1 ? 'devocional encontrado' : 'devocionais encontrados'}</p>{cards(filtered)}{!filtered.length && <div className="info">{items.length ? 'Nenhum devocional encontrado. Experimente outro termo.' : 'Ainda não há devocionais publicados.'}</div>}</>}
{(page === 'leitura' || page.startsWith('leitura/')) && (current ? <div className="reading-column"><a className="text-link" href="#historico">← Todos os devocionais</a><ReadingPosition key={`${userId}:${current.id}:${current.reading_revision}:${resumePosition}`} userId={userId} devotionalId={current.id} revision={current.reading_revision} resume={resumePosition}><article className="reading"><div className="eyebrow">{displayDate(current.publish_at)}</div><h1>{current.title}</h1><p className="muted">{current.author_name?.trim() ? `Por ${current.author_name.trim()}` : 'Autoria não informada'}</p><div className="reading-meta"><BibleReference reference={current.bible_reference} /> · {toCard(current).minutes} min de leitura estimada</div>{guidedDevotionalsEnabled && current.practical_challenge && current.prayer_prompt ? <GuidedDevotional key={`${userId}:${current.id}:${current.reading_revision}`} item={current} alreadyCompleted={completions.some(value => value.source_devotional_id === current.id)} onCompleted={() => setAttempt(value => value + 1)} /> : <>{current.bible_selection ? <DevotionalPassage key={`${current.id}:${current.reading_revision}`} selection={current.bible_selection} reference={current.bible_reference} /> : <LegacyDevotionalPassage reference={current.bible_reference} text={current.bible_text} />}<h2>Uma pausa para a alma</h2>{current.content.split(/\n\s*\n/).map((text, index) => <p key={index}>{text}</p>)}{current.reflection_question && <div className="reflection"><div className="eyebrow">☼ PARA REFLETIR</div><h3>{current.reflection_question}</h3><p>Leve essa pergunta com você ao longo do dia.</p></div>}<PrayerCapsuleForm devotionalId={current.id} /><ReadingProgress key={current.id} devotionalId={current.id} revision={current.reading_revision} onCompleted={() => setAttempt(value => value + 1)} onCompletedNow={() => setShareOpen(true)} /></>}</article></ReadingPosition>{!(guidedDevotionalsEnabled && current.practical_challenge && current.prayer_prompt) && <ShareDevotional key={current.id} id={current.id} title={current.title} phrase={current.share_phrase} author={current.author_name} reference={current.bible_reference} />}{shareOpen && <ShareCompletionDialog id={current.id} title={current.title} phrase={current.share_phrase} author={current.author_name} reference={current.bible_reference} onClose={closeShare} />}{!(guidedDevotionalsEnabled && current.practical_challenge && current.prayer_prompt) && <DiscussionSection key={`${userId}:${current.id}`} devotionalId={current.id} />}</div> : <div className="info">Devocional não encontrado ou indisponível. <a href="#historico">Voltar ao acervo</a></div>)}
    {page === 'minhas-leituras' && <>{embedded ? <div className="journey-openings"><h2>Minhas aberturas</h2><p className="muted">Seus registros pessoais de abertura. Uma abertura não significa leitura concluída.</p></div> : <><Heading eyebrow="SEUS MOMENTOS COM A PALAVRA" title="Histórico de aberturas" description="Seus registros pessoais de abertura. Uma abertura não significa leitura concluída." /><ConsistencySection userId={userId} refreshKey={attempt} /></>}{historyLoading ? <p role="status">Carregando histórico…</p> : historyError ? <div className="info" role="alert">{historyError} {retry}</div> : !openings.length ? <div className="info">Você ainda não abriu nenhum devocional.</div> : <div className="admin-list">{openings.map(event => { const item = items.find(value => value.id === event.devotional_id); return <div className="admin-row" key={event.id}><div><strong>{item?.title ?? 'Devocional indisponível'}</strong><small>Aberto em {new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.opened_at))}</small></div>{item && <button className="text-link" disabled={opening} onClick={() => open(item.id)}>Abrir novamente</button>}</div> })}</div>}</>}
    {page === 'minhas-leituras' && <section className="completion-history"><h2>Minhas conclusões</h2><p className="muted">Conclusões voluntárias, separadas das aberturas.</p>{completionsLoading ? <p role="status">Carregando conclusões…</p> : completionsError ? <div role="alert" className="info">{completionsError} {retry}</div> : !completions.length ? <p className="info">Você ainda não concluiu nenhum devocional.</p> : <div className="admin-list">{completions.map(event => { const item = items.find(value => value.id === event.devotional_id); return <div className="admin-row" key={event.source_devotional_id}><div><strong>{item?.title ?? 'Devocional indisponível'}</strong><small>Concluído em {displayDate(event.completed_at)} · Horário de Brasília</small></div>{item && <a className="text-link" href={`#leitura/${item.id}`}>Reler devocional</a>}</div> })}</div>}</section>}
    {page === 'minhas-leituras' && guidedDevotionalsEnabled && <PrivateResponseHistory userId={userId} items={items} />}
    {page !== 'minhas-leituras' && completionsError && <p className="info" role="alert">Não foi possível consultar suas conclusões. {completionsError}</p>}
  </>
}
