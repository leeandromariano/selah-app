import { useEffect, useMemo, useState } from 'react'
import { bibleHash, bookById, books } from '../bible/catalog'
import type { BibleFavorite, AnnotationStore } from '../bible/annotations'
import type { BibleProvider, Verse } from '../bible/provider'
import { reportBibleView } from '../bible/fums'
import { displayAttribution } from '../bible/attribution'

type Chapter = { verses: Verse[]; copyright: string } | null
const pageSize = 5
const chapterKey = (row: BibleFavorite) => `${row.translation}:${row.book}:${row.chapter}`

export function BibleFavorites({ userId, store, source, onOpen }: { userId: string; store: AnnotationStore; source: BibleProvider; onOpen: () => void }) {
  const [rows, setRows] = useState<BibleFavorite[] | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(0)
  const [chapters, setChapters] = useState<Record<string, Chapter>>({})
  useEffect(() => {
    let active = true
    store.listAllFavorites(userId).then(data => {
      if (!active) return
      setRows(data.sort((a, b) => books.findIndex(book => book.id === a.book) - books.findIndex(book => book.id === b.book) || a.chapter - b.chapter || a.verse_start - b.verse_start || a.translation.localeCompare(b.translation)))
      setError(false)
    }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [store, userId, attempt])
  const visible = useMemo(() => rows?.slice(page * pageSize, (page + 1) * pageSize) ?? [], [rows, page])
  useEffect(() => {
    let active = true
    const groups = [...new Map(visible.map(row => [chapterKey(row), row])).entries()]
    for (const [key, row] of groups) {
      const load = async (): Promise<Chapter> => {
        const translation = source.translations.find(item => item.id === row.translation && item.available)
        if (!translation || !source.chapterDetails) return null
        const chapter = await source.chapterDetails({ translation: row.translation, book: row.book, chapter: row.chapter })
        await reportBibleView(chapter.fumsToken)
        return { verses: chapter.verses, copyright: chapter.copyright }
      }
      load().then(chapter => { if (active) setChapters(previous => ({ ...previous, [key]: chapter })) }).catch(() => { if (active) setChapters(previous => ({ ...previous, [key]: null })) })
    }
    return () => { active = false }
  }, [visible, source])
  if (error) return <div role="alert">Não foi possível carregar seus favoritos. <button className="text-link" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></div>
  if (!rows) return <p role="status">Carregando favoritos…</p>
  if (!rows.length) return <p className="info">Você ainda não favoritou versículos. Para começar, toque em um versículo e escolha Favoritar.</p>
  return <div className="bible-favorites-list">
    <h2>Favoritados</h2>
    <p>{rows.length} {rows.length === 1 ? 'versículo favoritado' : 'versículos favoritados'}</p>
    {visible.map(row => {
      const chapter = chapters[chapterKey(row)]
      const verse = chapter?.verses.find(item => item.number <= row.verse_start && (item.endNumber ?? item.number) >= row.verse_end)
      const name = bookById(row.book)?.name ?? row.book
      const reference = `${name} ${row.chapter}:${row.verse_start}${row.verse_end !== row.verse_start ? `–${row.verse_end}` : ''}`
      return <article className="bible-favorite-card" key={`${chapterKey(row)}:${row.verse_start}:${row.verse_end}`}>
        <h3><a onClick={onOpen} href={bibleHash({ translation: row.translation, book: row.book, chapter: row.chapter, verse: row.verse_start, endVerse: row.verse_end === row.verse_start ? undefined : row.verse_end })}>{reference} · {row.translation.toUpperCase()}</a></h3>
        {chapter === undefined ? <p role="status">Carregando versículo…</p> : verse ? <><p>{verse.text}</p><small>{displayAttribution(chapter?.copyright ?? '')}</small></> : <p>Texto indisponível no momento. Abra a passagem para tentar novamente.</p>}
      </article>
    })}
    <nav className="actions" aria-label="Páginas de favoritos"><button className="button secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anteriores</button><span>Página {page + 1} de {Math.ceil(rows.length / pageSize)}</span><button className="button secondary" disabled={(page + 1) * pageSize >= rows.length} onClick={() => setPage(value => value + 1)}>Próximos</button></nav>
  </div>
}
