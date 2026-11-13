import { useEffect, useState } from 'react'
import { books } from '../bible/catalog'
import { fetchApiChapter } from '../bible/apiClient'
import { reportBibleView } from '../bible/fums'
import type { ApiChapter } from '../bible/apiChapter'
import type { Location } from '../bible/catalog'

export type BibleSelection = Location & { verse: number; endVerse: number; reference: string }
type Props = { onSelect: (selection: BibleSelection) => void; load?: (location: Location) => Promise<ApiChapter>; report?: (token: string) => Promise<void> }

// Passagem de um versículo até o capítulo inteiro (mesmo capítulo). O texto não é copiado: só livro, capítulo e faixa.
export function BiblePassagePicker({ onSelect, load = fetchApiChapter, report = reportBibleView }: Props) {
  const [translation, setTranslation] = useState('nvt')
  const [book, setBook] = useState('genesis')
  const [chapter, setChapter] = useState(1)
  const [passage, setPassage] = useState<ApiChapter | null>(null)
  const [verse, setVerse] = useState(0)
  const [endVerse, setEndVerse] = useState(0)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const currentBook = books.find(item => item.id === book)!
  useEffect(() => {
    let active = true
    load({ translation, book, chapter }).then(async result => {
      await report(result.fumsToken)
      if (active) {
        const first = result.verses[0]
        setPassage(result); setVerse(first?.number ?? 0); setEndVerse(first ? first.endNumber ?? first.number : 0); setError('')
      }
    }).catch(() => { if (active) { setPassage(null); setError('Não foi possível carregar os versículos. Tente novamente.') } })
    return () => { active = false }
  }, [translation, book, chapter, load, report, attempt])
  const reset = () => { setPassage(null); setVerse(0); setEndVerse(0); setError('') }
  const verses = passage?.verses ?? []
  const last = verses[verses.length - 1]
  const lastEnd = last ? last.endNumber ?? last.number : 0
  const startItem = verses.find(item => item.number === verse)
  const chosen = verses.filter(item => item.number >= verse && (item.endNumber ?? item.number) <= endVerse)
  const wholeChapter = verses.length > 0 && verse === verses[0].number && endVerse === lastEnd
  const changeStart = (number: number) => {
    const item = verses.find(candidate => candidate.number === number)
    setVerse(number); setEndVerse(item ? item.endNumber ?? item.number : number)
  }
  const toggleWhole = (checked: boolean) => {
    const first = verses[0]
    if (!first) return
    setVerse(first.number); setEndVerse(checked ? lastEnd : first.endNumber ?? first.number)
  }
  const confirm = () => {
    if (!startItem || chosen.length === 0) return
    const reference = wholeChapter ? `${currentBook.name} ${chapter}` : `${currentBook.name} ${chapter}:${verse}${endVerse !== verse ? `-${endVerse}` : ''}`
    onSelect({ translation, book, chapter, verse, endVerse, reference })
  }
  return <section aria-label="Selecionar passagem bíblica">
    <h4>Escolher passagem bíblica</h4>
    <label>Tradução<select value={translation} onChange={event => { reset(); setTranslation(event.target.value) }}><option value="nvt">NVT</option><option value="ara">ARA</option><option value="ntlh">NTLH</option></select></label>
    <label>Livro<select value={book} onChange={event => { reset(); setBook(event.target.value); setChapter(1) }}>{books.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Capítulo<select value={chapter} onChange={event => { reset(); setChapter(Number(event.target.value)) }}>{Array.from({ length: currentBook.chapters }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
    {error ? <div role="alert">{error} <button type="button" onClick={() => { reset(); setAttempt(value => value + 1) }}>Tentar novamente</button></div> : !passage ? <p role="status">Carregando versículos…</p> : <>
      <label>Do versículo<select value={verse} onChange={event => changeStart(Number(event.target.value))}>{verses.map(item => <option key={item.number} value={item.number}>{item.number}{item.endNumber ? `–${item.endNumber}` : ''}</option>)}</select></label>
      <label>Até o versículo<select value={endVerse} onChange={event => setEndVerse(Number(event.target.value))}>{verses.filter(item => item.number >= verse).map(item => { const end = item.endNumber ?? item.number; return <option key={item.number} value={end}>{end}</option> })}</select></label>
      <label><input type="checkbox" checked={wholeChapter} onChange={event => toggleWhole(event.target.checked)} /> Usar o capítulo inteiro</label>
      {chosen.length === 1 ? <p>{chosen[0].text}</p> : chosen.length > 1 && <div className="bible-picker-preview" aria-label="Texto da passagem escolhida">{chosen.map(item => <p key={item.number}><sup>{item.number}{item.endNumber ? `–${item.endNumber}` : ''}</sup> {item.text}</p>)}</div>}
      <p className="muted">{passage.copyright}</p>
      <button className="button secondary" type="button" onClick={confirm} disabled={chosen.length === 0}>Usar passagem</button>
    </>}
  </section>
}
