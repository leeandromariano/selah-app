import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { books } from '../bible/catalog'
import { PANORAMA_LIMITS, parsePanoramaImport } from '../study/panoramaImport'
import type { PanoramaRow } from '../study/panoramaImport'
import { createStudyRepository } from '../study/repository'
import type { OwnerStudyPanorama, StudyStatus } from '../study/repository'

const repository = createStudyRepository(supabase)
const blank = { book: books[0].id, author: '', audience: '', context: '', theme: '', status: 'draft' as StudyStatus }
type Draft = typeof blank

// Panorama dos livros no painel OWNER: uma ficha por livro (autor, para quem, contexto, tema). Entra como rascunho e só aparece
// para os leitores, no modo Estudo antes do capítulo 1, depois de publicada.
export function StudyPanoramaManager() {
  const [items, setItems] = useState<OwnerStudyPanorama[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<{ draft: Draft; isNew: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const [preview, setPreview] = useState<{ rows: PanoramaRow[]; error?: string } | null>(null)
  const [updateExisting, setUpdateExisting] = useState(false)
  useEffect(() => {
    let active = true
    repository.ownerListPanoramas().then(list => { if (active) { setItems(list); setError('') } }).catch(() => { if (active) setError('Não foi possível carregar os panoramas.') })
    return () => { active = false }
  }, [attempt])

  const byBook = new Map((items ?? []).map(item => [item.book, item]))
  const set = (patch: Partial<Draft>) => setEditing(current => current ? { ...current, draft: { ...current.draft, ...patch } } : current)
  const refresh = () => setAttempt(value => value + 1)

  async function save(event: FormEvent | null, override?: StudyStatus) {
    event?.preventDefault()
    if (!editing || busy) return
    const { draft } = editing
    const values = { book: draft.book, author: draft.author.trim(), audience: draft.audience.trim(), context: draft.context.trim(), theme: draft.theme.trim() }
    if (!values.author || !values.audience || !values.context || !values.theme) { setNotice('Preencha os quatro campos da ficha.'); return }
    setBusy(true); setNotice('')
    try {
      await repository.ownerSavePanorama({ ...values, status: override ?? draft.status })
      setEditing(null); setNotice(override === 'published' ? 'Panorama publicado: já aparece no modo Estudo.' : 'Panorama salvo.'); refresh()
    } catch { setNotice('Não foi possível salvar o panorama. Confira os campos e tente novamente.') }
    finally { setBusy(false) }
  }
  async function setStatus(item: OwnerStudyPanorama, status: StudyStatus) {
    if (busy) return
    setBusy(true); setNotice('')
    try { await repository.ownerSavePanorama({ ...item, status }); setNotice(status === 'published' ? 'Panorama publicado.' : 'Panorama despublicado: voltou a rascunho.'); refresh() }
    catch { setNotice('Não foi possível atualizar o panorama.') }
    finally { setBusy(false) }
  }
  async function remove(item: OwnerStudyPanorama) {
    const name = books.find(book => book.id === item.book)?.name ?? item.book
    if (busy || !window.confirm(`Excluir o panorama de "${name}" de vez? Isso não pode ser desfeito.`)) return
    setBusy(true); setNotice('')
    try { await repository.ownerDeletePanorama(item.book); setNotice('Panorama excluído.'); refresh() }
    catch { setNotice('Não foi possível excluir o panorama.') }
    finally { setBusy(false) }
  }
  async function bulk(status: StudyStatus) {
    if (busy) return
    const targets = (items ?? []).filter(item => selected.includes(item.book) && item.status !== status)
    setBusy(true); setNotice('')
    let done = 0, failed = 0
    for (const item of targets) { try { await repository.ownerSavePanorama({ ...item, status }); done += 1 } catch { failed += 1 } }
    setBusy(false); setSelected([]); refresh()
    setNotice(`${done} panorama(s) ${status === 'published' ? 'publicado(s)' : 'voltaram a rascunho'}${failed ? `; ${failed} com erro` : ''}.`)
  }
  async function readFile(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    setImportText(text); setPreview(parsePanoramaImport(text)); setNotice('')
  }
  async function runImport() {
    if (!preview || busy) return
    setBusy(true); setNotice('')
    let created = 0, updated = 0, skipped = 0, failed = 0
    for (const row of preview.rows) {
      if (!row.input) continue
      const found = byBook.get(row.input.book)
      if (found && !updateExisting) { skipped += 1; continue }
      try { await repository.ownerSavePanorama({ ...row.input, status: found?.status ?? 'draft' }); if (found) updated += 1; else created += 1 } catch { failed += 1 }
    }
    setBusy(false); setPreview(null); setImportText(''); setImporting(false); refresh()
    setNotice(`Importação concluída: ${created} novo(s) como rascunho, ${updated} atualizado(s), ${skipped} já existente(s) ignorado(s)${failed ? `, ${failed} com erro ao salvar` : ''}.`)
  }
  const toggle = (book: string) => setSelected(current => current.includes(book) ? current.filter(item => item !== book) : [...current, book])
  const existingIds = (items ?? []).map(item => item.book)
  const valid = preview?.rows.filter(row => row.input) ?? []
  const willWrite = valid.filter(row => updateExisting || !byBook.has(row.input!.book)).length

  return <section className="study-manager" aria-labelledby="study-panorama-title">
    <div className="section-heading"><div><div className="eyebrow">RAIO-X DO TEXTO</div><h2 id="study-panorama-title">Panorama dos livros</h2></div>
      <div className="actions"><button type="button" className="button secondary" aria-expanded={importing} onClick={() => { setImporting(value => !value); setPreview(null) }}>Importar panoramas</button></div></div>
    <p className="muted">Uma ficha por livro: autor, para quem foi escrito, contexto em uma frase e tema central. Aparece recolhida antes do capítulo 1, só no modo Estudo, e só depois de publicada.</p>
    {error && <div className="info" role="alert">{error} <button type="button" className="button secondary" onClick={refresh}>Tentar novamente</button></div>}
    {notice && <p className="success" role="status">{notice}</p>}
    {importing && <div className="editor study-import">
      <h3>Importar panoramas em lote</h3>
      <p className="muted">Envie o arquivo (JSON) ou cole o conteúdo. Nada é enviado antes da conferência, e tudo entra como <strong>rascunho</strong>. O livro pode ser escrito como no app (Romanos, 1 Coríntios).</p>
      <label>Arquivo de panoramas<input type="file" accept=".json,application/json" onChange={event => void readFile(event.target.files?.[0])} /></label>
      <label>Ou cole aqui<textarea value={importText} onChange={event => { setImportText(event.target.value); setPreview(null) }} placeholder='[{ "book": "Romanos", "author": "...", "audience": "...", "context": "...", "theme": "..." }]' /></label>
      <div className="actions"><button type="button" className="button secondary" disabled={!importText.trim()} onClick={() => setPreview(parsePanoramaImport(importText))}>Conferir panoramas</button></div>
      {preview?.error && <div className="info" role="alert">{preview.error}</div>}
      {preview && !preview.error && <>
        <p role="status"><strong>{valid.length}</strong> panorama(s) válido(s), <strong>{preview.rows.length - valid.length}</strong> com problema, <strong>{valid.filter(row => byBook.has(row.input!.book)).length}</strong> já existe(m).</p>
        <ul className="study-preview">{preview.rows.map((row, index) => <li key={index} data-ok={row.input ? 'true' : 'false'}><strong>{row.label}</strong>{row.input ? <span>{byBook.has(row.input.book) ? 'já existe' : 'novo'}</span> : <span>{row.problems.join('; ')}</span>}</li>)}</ul>
        <label className="owner-check"><input type="checkbox" checked={updateExisting} onChange={event => setUpdateExisting(event.target.checked)} /> Atualizar os panoramas que já existem (mantém a situação atual)</label>
        <div className="actions"><button type="button" className="button primary" disabled={busy || !willWrite} onClick={() => void runImport()}>{busy ? 'Importando…' : `Importar ${willWrite} panorama(s) como rascunho`}</button></div>
      </>}
    </div>}
    {editing && <form className="editor study-editor" onSubmit={event => void save(event)} noValidate>
      <h3>{editing.isNew ? 'Novo panorama' : 'Editar panorama'}</h3>
      <fieldset disabled={busy}><div className="form-grid">
        <label>Livro<select value={editing.draft.book} disabled={!editing.isNew} onChange={event => set({ book: event.target.value })}>{books.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}</select></label>
        <label>Situação<select value={editing.draft.status} onChange={event => set({ status: event.target.value as StudyStatus })}><option value="draft">Rascunho</option><option value="published">Publicado</option></select></label>
        <label className="study-wide">Autor<input maxLength={PANORAMA_LIMITS.author} value={editing.draft.author} onChange={event => set({ author: event.target.value })} /></label>
        <label className="study-wide">Para quem foi escrito<input maxLength={PANORAMA_LIMITS.audience} value={editing.draft.audience} onChange={event => set({ audience: event.target.value })} /></label>
        <label className="study-wide">Contexto em uma frase<textarea maxLength={PANORAMA_LIMITS.context} value={editing.draft.context} onChange={event => set({ context: event.target.value })} /></label>
        <label className="study-wide">Tema central<input maxLength={PANORAMA_LIMITS.theme} value={editing.draft.theme} onChange={event => set({ theme: event.target.value })} /></label>
      </div>
      <div className="actions"><button className="button primary" type="submit">{busy ? 'Salvando…' : 'Salvar panorama'}</button>
        <button type="button" className="button secondary" onClick={() => void save(null, 'published')}>Salvar e publicar</button>
        <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancelar</button></div></fieldset>
    </form>}
    {!items && !error && <p role="status">Carregando panoramas…</p>}
    {items && <div className="study-bulk" role="group" aria-label="Seleção em lote">
      <label className="owner-check"><input type="checkbox" disabled={!items.length} checked={!!items.length && selected.length === items.length} onChange={event => setSelected(event.target.checked ? existingIds : [])} /> Selecionar todos</label>
      <button type="button" className="button secondary" disabled={busy} onClick={() => setSelected(items.filter(item => item.status === 'draft').map(item => item.book))}>Só rascunhos</button>
      <button type="button" className="button primary" disabled={busy || !selected.length} onClick={() => void bulk('published')}>Publicar selecionados ({selected.length})</button>
      <button type="button" className="button secondary" disabled={busy || !selected.length} onClick={() => void bulk('draft')}>Despublicar selecionados</button>
    </div>}
    {items && <ul className="study-list">{books.map(book => { const item = byBook.get(book.id); return <li key={book.id}>
      <input type="checkbox" className="study-pick" aria-label={`Selecionar ${book.name}`} disabled={!item} checked={selected.includes(book.id)} onChange={() => toggle(book.id)} />
      <div><strong>{book.name}</strong>{item ? <small>{item.author}</small> : <small>{book.testament}</small>}</div>
      <span className="chip" data-status={item?.status ?? 'none'}>{item ? (item.status === 'published' ? 'Publicado' : 'Rascunho') : 'Sem panorama'}</span>
      <button type="button" className="text-link" disabled={busy} onClick={() => { setEditing({ draft: item ? { ...item } : { ...blank, book: book.id }, isNew: !item }); setNotice('') }}>{item ? 'Editar' : 'Criar'}</button>
      {item && <button type="button" className="text-link" disabled={busy} onClick={() => void setStatus(item, item.status === 'published' ? 'draft' : 'published')}>{item.status === 'published' ? 'Despublicar' : 'Publicar'}</button>}
      {item && <button type="button" className="text-link" disabled={busy} onClick={() => void remove(item)}>Excluir</button>}
    </li> })}</ul>}
  </section>
}
