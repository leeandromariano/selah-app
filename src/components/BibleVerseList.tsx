import { useEffect, useState } from 'react'
import type { BibleAnnotation, BibleFavorite, AnnotationColor, AnnotationStore } from '../bible/annotations'
import { bibleFavoritesEnabled } from '../bible/favoritesFeature'
import { bookById } from '../bible/catalog'
import type { Location } from '../bible/catalog'
import type { Verse } from '../bible/provider'

type Props = { userId: string; location: Location; verses: Verse[]; copyright: string; store: AnnotationStore; highlighted: (verse: Verse) => boolean }
const colors: { value: AnnotationColor; label: string }[] = [{ value: 'yellow', label: 'Amarelo' }, { value: 'blue', label: 'Azul-claro' }, { value: 'pink', label: 'Rosa' }]
const icons = { copy: 'M8 8h10v12H8zM5 16H4V4h10v1', favorite: 'M6 3h12v18l-6-4-6 4z', note: 'M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3' }
function ActionIcon({ name }: { name: keyof typeof icons }) { return <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]} /></svg> }

export function BibleVerseList({ userId, location, verses, copyright, store, highlighted }: Props) {
  const { translation, book, chapter } = location
  const [rows, setRows] = useState<BibleAnnotation[]>([])
  const [favorites, setFavorites] = useState<BibleFavorite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [favoriteError, setFavoriteError] = useState('')
  const [favoritesLoading, setFavoritesLoading] = useState(bibleFavoritesEnabled)
  const [selected, setSelected] = useState<number[]>([])
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    store.list(userId, { translation, book, chapter }).then(result => { if (active) { setRows(result); setLoading(false); setError('') } }).catch(() => { if (active) { setLoading(false); setError('Não foi possível carregar suas anotações.') } })
    if (bibleFavoritesEnabled) store.listFavorites(userId, { translation, book, chapter }).then(result => { if (active) { setFavorites(result); setFavoriteError(''); setFavoritesLoading(false) } }).catch(() => { if (active) { setFavoriteError('Não foi possível carregar seus favoritos.'); setFavoritesLoading(false) } })
    return () => { active = false }
  }, [userId, translation, book, chapter, store, attempt])
  function open(verse: Verse) {
    const existing = rows.find(row => row.verse_start === verse.number && row.verse_end === (verse.endNumber ?? verse.number))
    setSelected(old => old.includes(verse.number) ? old.filter(number => number !== verse.number) : [...old, verse.number]); setNote(existing?.note ?? ''); setShowNote(false); setMessage('')
  }
  const identity = (verse: Verse): BibleFavorite => ({ user_id: userId, translation, book, chapter, verse_start: verse.number, verse_end: verse.endNumber ?? verse.number })
  async function saveMark(verse: Verse, nextColor: AnnotationColor | null, nextNote: string) {
    if (busy || loading || error) return
    const entry: BibleAnnotation = { ...identity(verse), color: nextColor, note: nextNote }
    const previous = rows.find(row => row.verse_start === entry.verse_start && row.verse_end === entry.verse_end)
    if (!entry.color && !entry.note.trim() && !previous) { setMessage('Selecione uma cor ou escreva uma anotação.'); return }
    setBusy(true); setMessage('')
    try {
      if (!entry.color && !entry.note.trim()) {
        if (previous) await store.remove(entry)
        setRows(old => old.filter(row => !(row.verse_start === entry.verse_start && row.verse_end === entry.verse_end)))
      } else {
        await store.save(entry)
        setRows(old => [...old.filter(row => !(row.verse_start === entry.verse_start && row.verse_end === entry.verse_end)), entry])
      }
      setMessage('Salvo na sua conta.')
    } catch { setMessage('Não foi possível salvar. Tente novamente.') }
    finally { setBusy(false) }
  }
  async function toggleFavorite(verse: Verse, exists: boolean) {
    if (busy || !bibleFavoritesEnabled || favoritesLoading || favoriteError) return
    const record = identity(verse)
    setBusy(true); setMessage('')
    try {
      if (exists) { await store.removeFavorite(record); setFavorites(old => old.filter(row => !(row.verse_start === record.verse_start && row.verse_end === record.verse_end))) }
      else { await store.addFavorite(record); setFavorites(old => [...old, record]) }
      setMessage(exists ? 'Removido dos favoritos.' : 'Adicionado aos favoritos.')
    } catch { setMessage('Não foi possível atualizar os favoritos. Tente novamente.') }
    finally { setBusy(false) }
  }
  async function copy(verse: Verse) {
    const label = `${bookById(book)?.name ?? book} ${chapter}:${verse.number}${verse.endNumber ? `-${verse.endNumber}` : ''} (${translation.toUpperCase()})`
    try { await navigator.clipboard.writeText(`${verse.text}\n${label}\n${copyright}\nAcesse o app: ${window.location.origin}/#biblia/${translation}/${book}/${chapter}/${verse.number}`); setMessage('Texto copiado.') }
    catch { setMessage('Não foi possível copiar. Selecione o texto e copie manualmente.') }
  }
  const chosen = verses.filter(verse => selected.includes(verse.number))
  const multiple = chosen.length > 1
  async function copySelected() {
    const text = chosen.map(verse => `${verse.number}${verse.endNumber ? `–${verse.endNumber}` : ''} ${verse.text}`).join('\n')
    const label = `${bookById(book)?.name ?? book} ${chapter}:${chosen.map(verse => verse.number).join(', ')} (${translation.toUpperCase()})`
    try { await navigator.clipboard.writeText(`${text}\n${label}\n${copyright}\nAcesse o app: ${window.location.origin}/#biblia/${translation}/${book}/${chapter}`); setMessage('Texto copiado.') }
    catch { setMessage('Não foi possível copiar. Tente novamente.') }
  }
  async function favoriteSelected() {
    if (busy || favoritesLoading || favoriteError) return
    const remove = chosen.every(verse => favorites.some(row => row.verse_start === verse.number && row.verse_end === (verse.endNumber ?? verse.number)))
    setBusy(true); setMessage('')
    try {
      for (const verse of chosen) {
        const record = identity(verse)
        if (remove) await store.removeFavorite(record)
        else if (!favorites.some(row => row.verse_start === record.verse_start && row.verse_end === record.verse_end)) await store.addFavorite(record)
      }
      setFavorites(old => remove ? old.filter(row => !selected.includes(row.verse_start)) : [...old, ...chosen.filter(verse => !old.some(row => row.verse_start === verse.number)).map(identity)])
      setMessage(remove ? 'Removidos dos favoritos.' : 'Adicionados aos favoritos.')
    } catch { setMessage('Alguns favoritos não foram atualizados. Recarregue e tente novamente.'); setAttempt(value => value + 1) }
    finally { setBusy(false) }
  }
  async function markSelected(color: AnnotationColor | null) {
    if (busy || loading || error) return
    setBusy(true); setMessage('')
    try {
      for (const verse of chosen) {
        const record = identity(verse), previous = rows.find(row => row.verse_start === record.verse_start && row.verse_end === record.verse_end)
        if (!color && !previous?.note.trim()) { if (previous) await store.remove(record) }
        else await store.save({ ...record, color, note: previous?.note ?? '' })
      }
      setRows(old => [...old.filter(row => !selected.includes(row.verse_start)), ...chosen.flatMap(verse => {
        const record = identity(verse), previous = old.find(row => row.verse_start === record.verse_start && row.verse_end === record.verse_end)
        return color || previous?.note.trim() ? [{ ...record, color, note: previous?.note ?? '' }] : []
      })])
      setMessage('Salvo na sua conta.')
    } catch { setMessage('Alguns destaques não foram salvos. Recarregue e tente novamente.'); setAttempt(value => value + 1) }
    finally { setBusy(false) }
  }
  return <>
    {loading && <p role="status">Carregando seus destaques e anotações…</p>}
    {(error || favoriteError) && <div role="alert">{error || favoriteError} <button type="button" onClick={() => { setLoading(true); setFavoritesLoading(bibleFavoritesEnabled); setError(''); setFavoriteError(''); setAttempt(value => value + 1) }}>Tentar novamente</button></div>}
    {verses.map(verse => {
      const mark = rows.find(row => row.verse_start === verse.number && row.verse_end === (verse.endNumber ?? verse.number))
      const favorite = favorites.some(row => row.verse_start === verse.number && row.verse_end === (verse.endNumber ?? verse.number))
      const label = `${verse.number}${verse.endNumber ? `–${verse.endNumber}` : ''}`
      const expanded = selected.includes(verse.number)
      return <div key={verse.number} className="bible-verse-item">
        <p id={`bible-verse-${verse.number}`} className={`bible-verse${highlighted(verse) ? ' highlighted' : ''}${mark?.color ? ` bible-mark-${mark.color}` : ''}${expanded ? ' bible-verse-selected' : ''}`}><button type="button" className="bible-verse-button" aria-expanded={expanded} aria-pressed={expanded} aria-label={`Versículo ${label}${favorite ? ', favorito' : ''}${mark?.note ? ', com anotação' : ''}`} aria-describedby={`bible-verse-text-${verse.number}`} onClick={() => open(verse)}><span className="bible-number">{label}</span> <span id={`bible-verse-text-${verse.number}`}>{verse.text}</span>{favorite && <span className="bible-saved-indicator" aria-hidden="true"> ♥</span>}{mark?.note && <span className="bible-saved-indicator" aria-hidden="true"> ✎</span>}</button></p>
        {expanded && !multiple && <div className="bible-verse-tools" role="group" aria-label={`Ações do versículo ${label}`}>
          <div className="bible-tools-header"><span>{bookById(book)?.name ?? book} {chapter}:{label} · {translation.toUpperCase()}</span><button type="button" className="bible-tools-close" aria-label="Fechar ações" onClick={() => setSelected([])}>×</button></div>
          <div className="bible-tools-row">
            <button type="button" className="bible-tool" onClick={() => void copy(verse)}><ActionIcon name="copy" /><span>Copiar</span></button>
            <button type="button" className="bible-tool" aria-pressed={favorite} disabled={busy || !bibleFavoritesEnabled || favoritesLoading || !!favoriteError} onClick={() => void toggleFavorite(verse, favorite)}><ActionIcon name="favorite" /><span>{favorite ? 'Favoritado' : 'Favoritar'}</span></button>
            <button type="button" className="bible-tool" aria-expanded={showNote} onClick={() => setShowNote(value => !value)}><ActionIcon name="note" /><span>Anotar</span></button>
            <div className="bible-color-divider" aria-hidden="true" />
            <div className="bible-colors" aria-label="Cor do destaque">{colors.map(item => <button type="button" key={item.value} className={`bible-color bible-color-${item.value}`} aria-label={`Destacar em ${item.label.toLocaleLowerCase('pt-BR')}`} title={item.label} aria-pressed={mark?.color === item.value} disabled={busy || loading || !!error} onClick={() => void saveMark(verse, mark?.color === item.value ? null : item.value, mark?.note ?? '')} />)}{mark?.color && <button type="button" className="bible-clear-color" disabled={busy} onClick={() => void saveMark(verse, null, mark.note)}>Remover destaque</button>}</div>
          </div>
          {showNote && <div className="bible-note-editor"><label>Anotação<textarea maxLength={3000} value={note} onChange={event => setNote(event.target.value)} /></label><button type="button" className="button secondary" disabled={busy || loading || !!error} onClick={() => void saveMark(verse, mark?.color ?? null, note)}>Salvar anotação</button></div>}
          {message && <p role="status" className="bible-tools-message">{message}</p>}
        </div>}
        {multiple && verse.number === chosen[chosen.length - 1].number && <div className="bible-verse-tools bible-multi-tools" role="group" aria-label="Ações dos versículos selecionados"><div className="bible-tools-header"><span>{chosen.length} versículos selecionados</span><button type="button" className="bible-tools-close" aria-label="Limpar seleção" onClick={() => setSelected([])}>×</button></div><div className="bible-tools-row"><button type="button" className="bible-tool" onClick={() => void copySelected()}><ActionIcon name="copy" /><span>Copiar</span></button><button type="button" className="bible-tool" disabled={busy || !bibleFavoritesEnabled || favoritesLoading || !!favoriteError} onClick={() => void favoriteSelected()}><ActionIcon name="favorite" /><span>{chosen.every(item => favorites.some(row => row.verse_start === item.number && row.verse_end === (item.endNumber ?? item.number))) ? 'Desfavoritar' : 'Favoritar'}</span></button><div className="bible-color-divider" aria-hidden="true" /><div className="bible-colors" aria-label="Cor do destaque">{colors.map(item => <button type="button" key={item.value} className={`bible-color bible-color-${item.value}`} aria-label={`Destacar selecionados em ${item.label.toLocaleLowerCase('pt-BR')}`} disabled={busy || loading || !!error} onClick={() => void markSelected(item.value)} />)}<button type="button" className="bible-clear-color" disabled={busy} onClick={() => void markSelected(null)}>Remover destaque</button></div></div>{message && <p role="status" className="bible-tools-message">{message}</p>}</div>}
      </div>
    })}
  </>
}
