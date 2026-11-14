import { useEffect, useState } from 'react'
import { bibleHash, parseReference } from '../bible/catalog'
import { displayAttribution } from '../bible/attribution'
import { fetchApiChapter } from '../bible/apiClient'
import { reportBibleView } from '../bible/fums'
import type { ApiChapter } from '../bible/apiChapter'
import type { Location } from '../bible/catalog'

const maxVerses = 8
type Props = { reference: string; load?: (location: Location) => Promise<ApiChapter>; report?: (token: string) => Promise<void> }

// Mostra o texto completo da passagem (ARA). Se a Bíblia estiver indisponível, a referência continua visível ao lado.
export function QuizVerse({ reference, load = fetchApiChapter, report = reportBibleView }: Props) {
  const [chapter, setChapter] = useState<ApiChapter | null>(null)
  const [failed, setFailed] = useState(false)
  const target = parseReference(reference)
  const book = target?.book, chapterNumber = target?.chapter, verse = target?.verse, endVerse = target?.endVerse ?? target?.verse
  useEffect(() => {
    if (!book || !chapterNumber || !verse) return
    let active = true
    load({ translation: 'ara', book, chapter: chapterNumber }).then(async result => {
      await report(result.fumsToken)
      if (active) setChapter(result)
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [book, chapterNumber, verse, load, report])
  if (!book || !chapterNumber || !verse || !endVerse || failed) return null
  if (!chapter) return <p className="muted" role="status">Carregando o versículo…</p>
  const matching = chapter.verses.filter(item => item.number <= endVerse && (item.endNumber ?? item.number) >= verse)
  if (!matching.length) return null
  const shown = matching.slice(0, maxVerses)
  const multiple = matching.length > 1
  return <blockquote className="quiz-verse">
    {shown.map(item => <p key={item.number}>{multiple && <sup>{item.number} </sup>}{item.text}</p>)}
    {matching.length > shown.length && <p className="muted">… <a className="text-link" href={bibleHash({ translation: 'ara', book, chapter: chapterNumber, verse, endVerse })}>ler a passagem completa na Bíblia</a></p>}
    <cite>{reference} · ARA</cite>
    <small>{displayAttribution(chapter.copyright)}</small>
  </blockquote>
}
