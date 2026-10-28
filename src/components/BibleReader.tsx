import { useEffect, useMemo, useState } from 'react'
import { adjacent, bibleHash, bookById, books, parseBibleRoute } from '../bible/catalog'
import type { Location } from '../bible/catalog'
import { bibleProvider } from '../bible/provider'
import type { BibleProvider, Verse } from '../bible/provider'
import { Heading } from './UI'
import './bible.css'

const defaultLocation: Location = { translation: 'demonstracao', book: 'genesis', chapter: 1 }
const storageKey = 'selah.bible.location'
function initialLocation() {
  try { return parseBibleRoute(sessionStorage.getItem(storageKey) ?? '') ?? defaultLocation } catch { return defaultLocation }
}
export function BibleReader({ page, source = bibleProvider }: { page: string; source?: BibleProvider }) {
  const route = useMemo(() => page === 'biblia' ? initialLocation() : parseBibleRoute(page), [page])
  const [result, setResult] = useState<{ key: string; source: BibleProvider; verses: Verse[] | null; error: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
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
    source.chapter(route).then(verses => { if (active) setResult({ key, source, verses, error: '' }) }).catch(() => { if (active) setResult({ key, source, verses: null, error: 'Não foi possível carregar este capítulo. Tente novamente.' }) })
    return () => { active = false }
  }, [key, route, source, translation?.available])
  useEffect(() => {
    if (!current?.verses || !route?.verse) return
    const target = document.getElementById(`bible-verse-${route.verse}`)
    target?.scrollIntoView?.({ block: 'center' })
    const timer = window.setTimeout(() => setExpiredHighlight(current), 5000)
    return () => window.clearTimeout(timer)
  }, [current, route?.verse])
  if (!route || !book) return <div role="alert" className="info">Endereço bíblico inválido. <a href="#biblia">Abrir Bíblia</a></div>
  if (!translation || !translation.available) return <div role="alert" className="info">Esta tradução está indisponível. <a href="#biblia/demonstracao/genesis/1">Abrir demonstração</a></div>
  const go = (next: Partial<Location>) => { location.hash = bibleHash({ ...route, verse: undefined, endVerse: undefined, ...next }) }
  const previous = adjacent(book.id, route.chapter, -1), next = adjacent(book.id, route.chapter, 1)
  const highlighted = (number: number) => current !== expiredHighlight && !!route.verse && number >= route.verse && number <= (route.endVerse ?? route.verse)
  const missingVerse = verses && route.verse && (!verses.some(verse => verse.number === route.verse) || (route.endVerse && !verses.some(verse => verse.number === route.endVerse)))
  return <section className="bible-reader" aria-label="Leitor bíblico">
    <Heading eyebrow="LEITURA" title="Bíblia" description="Escolha um livro e um capítulo para ler." />
    <p className="info">{translation.attribution}</p>
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
      {verses?.map(verse => <p id={`bible-verse-${verse.number}`} className={highlighted(verse.number) ? 'bible-verse highlighted' : 'bible-verse'} key={verse.number}><span className="bible-number">{verse.number}</span> {verse.text}</p>)}
    </article>
    <nav className="actions bible-navigation" aria-label="Navegação de capítulos"><button className="button secondary" disabled={!previous} onClick={() => previous && go(previous)}>← Capítulo anterior</button><button className="button secondary" disabled={!next} onClick={() => next && go(next)}>Próximo capítulo →</button></nav>
  </section>
}
