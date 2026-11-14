import { useEffect, useState } from 'react'
import { bibleHash, bookById } from '../bible/catalog'
import { fetchApiChapter } from '../bible/apiClient'
import { reportBibleView } from '../bible/fums'
import { displayAttribution } from '../bible/attribution'
import type { BibleSelectionRecord } from '../admin/repository'
import type { ApiChapter } from '../bible/apiChapter'

export function DevotionalPassage({ selection, reference, inlineChapter = false }: { selection: BibleSelectionRecord; reference: string; inlineChapter?: boolean }) {
  const [chapter, setChapter] = useState<ApiChapter | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    fetchApiChapter(selection).then(async result => {
      await reportBibleView(result.fumsToken)
      if (active) setChapter(result)
    }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [selection])
  const matching = chapter?.verses.filter(item => item.number <= selection.endVerse && (item.endNumber ?? item.number) >= selection.verse) ?? []
  // A faixa pode ter vários versículos (até o capítulo inteiro): vale se começa e termina exatamente onde foi escolhida.
  const lastMatch = matching[matching.length - 1]
  const valid = matching.length >= 1 && matching[0].number === selection.verse && (lastMatch.endNumber ?? lastMatch.number) === selection.endVerse
  const href = bibleHash(selection)
  if (error || (chapter && !valid)) return <p role="alert">Não foi possível carregar a passagem bíblica. <a href={href}>Abrir na Bíblia</a></p>
  if (!chapter) return <p role="status">Carregando passagem bíblica…</p>
  return <>
    <blockquote onDoubleClick={() => { location.hash = href }}><span>“</span>{matching.length === 1 ? matching[0].text : matching.map(item => <span key={item.number} className="devotional-verse"><sup>{item.number}{item.endNumber ? `–${item.endNumber}` : ''}</sup> {item.text} </span>)}<cite>{reference} · {selection.translation.toUpperCase()}</cite><small>{displayAttribution(chapter.copyright)}</small><a className="text-link devotional-bible-link" href={href}>Abrir na Bíblia</a></blockquote>
    {inlineChapter && <details className="devotional-chapter"><summary>Ler capítulo completo aqui</summary><div className="devotional-chapter-content"><h3>{bookById(selection.book)?.name ?? selection.book} {selection.chapter} · {selection.translation.toUpperCase()}</h3><div className="devotional-chapter-verses">{chapter.verses.map(verse => <p key={verse.number} className={verse.number <= selection.endVerse && (verse.endNumber ?? verse.number) >= selection.verse ? 'selected' : undefined}><span className="bible-number">{verse.number}{verse.endNumber ? `–${verse.endNumber}` : ''}</span> {verse.text}</p>)}</div><p className="bible-attribution">{displayAttribution(chapter.copyright)}</p></div></details>}
  </>
}
