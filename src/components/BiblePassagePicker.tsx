import { useEffect, useState } from 'react'
import { books } from '../bible/catalog'
import { fetchApiChapter } from '../bible/apiClient'
import { reportBibleView } from '../bible/fums'
import type { ApiChapter } from '../bible/apiChapter'
import type { Location } from '../bible/catalog'

export type BibleSelection = Location & { verse: number; endVerse: number; reference: string }
type Props = { onSelect: (selection: BibleSelection) => void; load?: (location: Location) => Promise<ApiChapter>; report?: (token: string) => Promise<void> }

export function BiblePassagePicker({ onSelect, load = fetchApiChapter, report = reportBibleView }: Props) {
  const [translation, setTranslation] = useState('nvt')
  const [book, setBook] = useState('genesis')
  const [chapter, setChapter] = useState(1)
  const [passage, setPassage] = useState<ApiChapter | null>(null)
  const [verse, setVerse] = useState(0)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const currentBook = books.find(item => item.id === book)!
  useEffect(() => {
    let active = true
    load({ translation, book, chapter }).then(async result => {
      await report(result.fumsToken)
      if (active) { setPassage(result); setVerse(result.verses[0]?.number ?? 0); setError('') }
    }).catch(() => { if (active) { setPassage(null); setError('Não foi possível carregar os versículos. Tente novamente.') } })
    return () => { active = false }
  }, [translation, book, chapter, load, report, attempt])
  const reset = () => { setPassage(null); setVerse(0); setError('') }
  const selected = passage?.verses.find(item => item.number === verse)
  const confirm = () => {
    if (!selected) return
    const endVerse = selected.endNumber ?? selected.number
    onSelect({ translation, book, chapter, verse, endVerse, reference: `${currentBook.name} ${chapter}:${verse}${endVerse !== verse ? `-${endVerse}` : ''}` })
  }
  return <section aria-label="Selecionar passagem bíblica">
    <h4>Escolher passagem bíblica</h4>
    <label>Tradução<select value={translation} onChange={event => { reset(); setTranslation(event.target.value) }}><option value="nvt">NVT</option><option value="ara">ARA</option><option value="ntlh">NTLH</option></select></label>
    <label>Livro<select value={book} onChange={event => { reset(); setBook(event.target.value); setChapter(1) }}>{books.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Capítulo<select value={chapter} onChange={event => { reset(); setChapter(Number(event.target.value)) }}>{Array.from({ length: currentBook.chapters }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
    {error ? <div role="alert">{error} <button type="button" onClick={() => { reset(); setAttempt(value => value + 1) }}>Tentar novamente</button></div> : !passage ? <p role="status">Carregando versículos…</p> : <>
      <label>Versículo<select value={verse} onChange={event => setVerse(Number(event.target.value))}>{passage.verses.map(item => <option key={item.number} value={item.number}>{item.number}{item.endNumber ? `–${item.endNumber}` : ''}</option>)}</select></label>
      {selected && <p>{selected.text}</p>}
      <p className="muted">{passage.copyright}</p>
      <button className="button secondary" type="button" onClick={confirm} disabled={!selected}>Usar passagem</button>
    </>}
  </section>
}
