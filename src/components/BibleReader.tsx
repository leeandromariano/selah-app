import { useEffect, useMemo, useState } from 'react'
import { adjacent, bibleHash, bookById, books, parseBibleRoute, parseReference } from '../bible/catalog'
import type { Location } from '../bible/catalog'
import { bibleProvider } from '../bible/provider'
import type { BibleProvider, Verse } from '../bible/provider'
import { reportBibleView } from '../bible/fums'
import { bibleAnnotationsEnabled } from '../bible/annotationsFeature'
import { bibleFavoritesEnabled } from '../bible/favoritesFeature'
import { bibleAvailable } from '../bible/availability'
import { displayAttribution } from '../bible/attribution'
import type { AnnotationStore } from '../bible/annotations'
import { BibleVerseList } from './BibleVerseList'
import { BibleFavorites } from './BibleFavorites'
import { Heading } from './UI'
import { ReadingFontControl } from './ReadingFontControl'
import './bible.css'

const defaultLocation: Location = { translation: bibleAvailable ? 'nvt' : 'demonstracao', book: 'genesis', chapter: 1 }
const storageKey = 'selah.bible.location'
const bookGroups = [
  { name: 'Pentateuco', start: 0, end: 5 },
  { name: 'Históricos', start: 5, end: 17 },
  { name: 'Poéticos e sabedoria', start: 17, end: 22 },
  { name: 'Profetas', start: 22, end: 39 },
  { name: 'Evangelhos e Atos', start: 39, end: 44 },
  { name: 'Cartas', start: 44, end: 65 },
  { name: 'Apocalipse', start: 65, end: 66 },
] as const
function initialLocation() {
  try { const saved = parseBibleRoute(sessionStorage.getItem(storageKey) ?? ''); return !saved || (bibleAvailable && saved.translation === 'demonstracao') ? defaultLocation : saved } catch { return defaultLocation }
}
export function BibleReader({ page, source = bibleProvider, userId, annotationStore }: { page: string; source?: BibleProvider; userId?: string; annotationStore?: AnnotationStore }) {
  const route = useMemo(() => page === 'biblia' ? initialLocation() : parseBibleRoute(page), [page])
  const [result, setResult] = useState<{ key: string; source: BibleProvider; verses: Verse[] | null; error: string; copyright?: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [showFavorites, setShowFavorites] = useState(false)
  const [reference, setReference] = useState('')
  const [referenceError, setReferenceError] = useState('')
  const [expiredHighlight, setExpiredHighlight] = useState<typeof result>(null)
  const translation = source.translations.find(item => item.id === route?.translation)
  const book = route && bookById(route.book)
  const key = `${page}:${attempt}`
  const current = result?.key === key && result.source === source ? result : null
  const verses = current?.verses ?? null, error = current?.error ?? ''
  useEffect(() => {
    if (!route || !translation?.available) return
    let active = true
    try { sessionStorage.setItem(storageKey, bibleHash(route).slice(1)) } catch { /* optional persistence */ }
    const load = async () => {
      if (source.chapterDetails && ['nvt', 'ara', 'ntlh'].includes(route.translation)) {
        const chapter = await source.chapterDetails(route)
        if (!active) return
        await reportBibleView(chapter.fumsToken)
        if (active) setResult({ key, source, verses: chapter.verses, copyright: chapter.copyright, error: '' })
      } else {
        const verses = await source.chapter(route)
        if (active) setResult({ key, source, verses, error: '' })
      }
    }
    load().catch(() => { if (active) setResult({ key, source, verses: null, error: 'Não foi possível carregar este capítulo. Tente novamente.' }) })
    return () => { active = false }
  }, [key, route, source, translation?.available])
  useEffect(() => {
    if (!current?.verses || !route?.verse) return
    const matching = current.verses.find(verse => route.verse! >= verse.number && route.verse! <= (verse.endNumber ?? verse.number))
    const target = document.getElementById(`bible-verse-${matching?.number ?? route.verse}`)
    target?.scrollIntoView?.({ block: 'center' })
    const timer = window.setTimeout(() => setExpiredHighlight(current), 5000)
    return () => window.clearTimeout(timer)
  }, [current, route?.verse])
  if (!route || !book) return <div role="alert" className="info">Endereço bíblico inválido. <a href="#biblia">Abrir Bíblia</a></div>
  if (!translation || !translation.available) return <div role="alert" className="info">Esta tradução está indisponível. <a href="#biblia">Abrir Bíblia</a></div>
  const go = (next: Partial<Location>) => { location.hash = bibleHash({ ...route, verse: undefined, endVerse: undefined, ...next }) }
  const previous = adjacent(book.id, route.chapter, -1), next = adjacent(book.id, route.chapter, 1)
  const contains = (verse: Verse, number: number) => number >= verse.number && number <= (verse.endNumber ?? verse.number)
  const highlighted = (verse: Verse) => current !== expiredHighlight && !!route.verse && verse.number <= (route.endVerse ?? route.verse) && (verse.endNumber ?? verse.number) >= route.verse
  const missingVerse = verses && route.verse && (!verses.some(verse => contains(verse, route.verse!)) || (route.endVerse && !verses.some(verse => contains(verse, route.endVerse!))))
  return <section className="bible-reader" aria-label="Leitor bíblico">
    <Heading eyebrow="LEITURA" title="Bíblia" description="Escolha um livro e um capítulo para ler." />
    {bibleFavoritesEnabled && userId && annotationStore && <button className="button secondary bible-favorites-toggle" aria-expanded={showFavorites} onClick={() => setShowFavorites(value => !value)}>{showFavorites ? '← Voltar à Bíblia' : '♡ Favoritados'}</button>}
    <ReadingFontControl />
    {showFavorites && userId && annotationStore ? <BibleFavorites key={userId} userId={userId} store={annotationStore} source={source} onOpen={() => setShowFavorites(false)} /> : <>
    <form className="bible-jump" onSubmit={event => { event.preventDefault(); const target = parseReference(reference); if (!target) { setReferenceError('Digite uma referência completa, como João 3:16.'); return } setReferenceError(''); go(target) }}>
      <label>Ir para uma passagem<input type="search" value={reference} onChange={event => { setReference(event.target.value); setReferenceError('') }} placeholder="Ex.: João 3:16 ou João 3 16" /></label>
      <button type="submit" className="button secondary">Abrir passagem</button>
      {referenceError && <p role="alert">{referenceError}</p>}
    </form>
    <details className="bible-book-picker"><summary>Explorar livros por categoria</summary><div className="bible-book-groups">{bookGroups.map(group => <section key={group.name} aria-label={group.name}><h3>{group.name}</h3><div>{books.slice(group.start, group.end).map(item => <button type="button" key={item.id} aria-pressed={item.id === book.id} onClick={() => go({ book: item.id, chapter: 1 })}>{item.name}</button>)}</div></section>)}</div></details>
    <div className="bible-controls">
      <label>Tradução<select value={translation.id} onChange={event => go({ translation: event.target.value })}>{source.translations.map(item => <option key={item.id} value={item.id} disabled={!item.available}>{item.name}{!item.available ? ' — indisponível' : ''}</option>)}</select></label>
      <label>Livro<select value={book.id} onChange={event => go({ book: event.target.value, chapter: 1 })}>{(['Antigo Testamento', 'Novo Testamento'] as const).map(testament => <optgroup key={testament} label={testament}>{books.filter(item => item.testament === testament).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}</select></label>
      <label>Capítulo<select value={route.chapter} onChange={event => go({ chapter: Number(event.target.value) })}>{Array.from({ length: book.chapters }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
    </div>
    <article className="reading bible-chapter"><h2>{book.name} {route.chapter} <small>· {translation.abbreviation}</small></h2>
      {!verses && !error && <p role="status">Carregando capítulo…</p>}
      {error && <div role="alert">{error} <button className="text-link" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></div>}
      {verses && !verses.length && <p className="info">Nenhum conteúdo disponível para este capítulo.</p>}
      {missingVerse && <p className="info" role="status">O versículo solicitado não está disponível neste capítulo.</p>}
      {verses && bibleAnnotationsEnabled && userId && annotationStore && current?.copyright && ['nvt', 'ara', 'ntlh'].includes(route.translation)
        ? <BibleVerseList key={`${userId}:${route.translation}:${route.book}:${route.chapter}`} userId={userId} location={route} verses={verses} copyright={current.copyright} store={annotationStore} highlighted={highlighted} />
        : verses?.map(verse => <p id={`bible-verse-${verse.number}`} className={highlighted(verse) ? 'bible-verse highlighted' : 'bible-verse'} key={verse.number}><span className="bible-number">{verse.number}{verse.endNumber ? `–${verse.endNumber}` : ''}</span> {verse.text}</p>)}
    </article>
    <p className="bible-attribution">{displayAttribution(current?.copyright ?? translation.attribution)}</p>
    <nav className="actions bible-navigation" aria-label="Navegação de capítulos"><button className="button secondary" disabled={!previous} onClick={() => previous && go(previous)}>← Capítulo anterior</button><button className="button secondary" disabled={!next} onClick={() => next && go(next)}>Próximo capítulo →</button></nav>
    </>}
  </section>
}
