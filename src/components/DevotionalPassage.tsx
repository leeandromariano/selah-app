import { useEffect, useState } from 'react'
import { bibleHash } from '../bible/catalog'
import { fetchApiChapter } from '../bible/apiClient'
import { reportBibleView } from '../bible/fums'
import type { BibleSelectionRecord } from '../admin/repository'
import type { ApiChapter } from '../bible/apiChapter'

export function DevotionalPassage({ selection, reference }: { selection: BibleSelectionRecord; reference: string }) {
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
  const valid = matching.length === 1 && matching[0].number === selection.verse && (matching[0].endNumber ?? matching[0].number) === selection.endVerse
  const href = bibleHash(selection)
  if (error || (chapter && !valid)) return <p role="alert">Não foi possível carregar a passagem bíblica. <a href={href}>Abrir na Bíblia</a></p>
  if (!chapter) return <p role="status">Carregando passagem bíblica…</p>
  return <blockquote onDoubleClick={() => { location.hash = href }}><span>“</span>{matching.map(item => item.text).join(' ')}<cite>{reference} · {selection.translation.toUpperCase()}</cite><small>{chapter.copyright}</small><a className="text-link" href={href}>Abrir na Bíblia</a></blockquote>
}
