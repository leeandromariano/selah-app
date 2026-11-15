import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { bookById } from '../bible/catalog'
import { parseImport, parseVerses } from '../study/import'
import type { ImportRow } from '../study/import'
import { createStudyRepository } from '../study/repository'
import type { OwnerStudyTerm, StudyStatus } from '../study/repository'

const repository = createStudyRepository(supabase)
const blank = { id: null as string | null, term: '', words: '', original: '', context: '', parallel_reference: '', verses: '', status: 'draft' as StudyStatus }
type Draft = typeof blank

const verseLine = (item: { book: string; chapter: number; start: number; end: number }) =>
  `${bookById(item.book)?.name ?? item.book} ${item.chapter}:${item.start}${item.end > item.start ? `-${item.end}` : ''}`
const toDraft = (item: OwnerStudyTerm): Draft => ({ id: item.id, term: item.term, words: item.words.join(', '), original: item.original, context: item.context, parallel_reference: item.parallel_reference, verses: item.verses.map(verseLine).join('\n'), status: item.status })

// Raio-X do Texto no painel OWNER: os termos entram como rascunho e só aparecem para os leitores depois de publicados.
export function StudyTermsManager() {
  const [items, setItems] = useState<OwnerStudyTerm[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const [preview, setPreview] = useState<{ rows: ImportRow[]; error?: string } | null>(null)
  const [updateExisting, setUpdateExisting] = useState(false)
  useEffect(() => {
    let active = true
    repository.ownerList().then(list => { if (active) { setItems(list); setError('') } }).catch(() => { if (active) setError('Não foi possível carregar os termos.') })
    return () => { active = false }
  }, [attempt])

  async function save(event: FormEvent | null, override?: StudyStatus) {
    event?.preventDefault()
    if (!editing || busy) return
    const { verses, invalid } = parseVerses(editing.verses.split('\n'))
    const words = editing.words.split(',').map(word => word.trim()).filter(Boolean)
    if (invalid) { setNotice(`Versículo inválido: "${invalid}". Use o formato "Efésios 2:8" ou "Efésios 2:8-9".`); return }
    if (!editing.term.trim() || !words.length || !editing.original.trim() || !editing.context.trim() || !editing.parallel_reference.trim() || !verses.length) { setNotice('Preencha todos os campos e ao menos um versículo.'); return }
    setBusy(true); setNotice('')
    try {
      await repository.ownerSave({ id: editing.id, term: editing.term.trim(), words, original: editing.original.trim(), context: editing.context.trim(), parallel_reference: editing.parallel_reference.trim(), status: override ?? editing.status, verses })
      setEditing(null); setNotice(override === 'published' ? 'Termo publicado: já aparece para os leitores.' : 'Termo salvo.'); setAttempt(value => value + 1)
    } catch { setNotice('Não foi possível salvar o termo. Confira os campos e tente novamente.') }
    finally { setBusy(false) }
  }
  async function toggle(item: OwnerStudyTerm) {
    if (busy) return
    setBusy(true); setNotice('')
    try {
      await repository.ownerSave({ id: item.id, term: item.term, words: item.words, original: item.original, context: item.context, parallel_reference: item.parallel_reference, status: item.status === 'published' ? 'draft' : 'published', verses: item.verses })
      setNotice(item.status === 'published' ? 'Termo despublicado: voltou a rascunho.' : 'Termo publicado.'); setAttempt(value => value + 1)
    } catch { setNotice('Não foi possível atualizar o termo.') }
    finally { setBusy(false) }
  }
  async function remove(item: OwnerStudyTerm) {
    if (busy || !window.confirm(`Excluir "${item.term}" de vez? Isso não pode ser desfeito.`)) return
    setBusy(true); setNotice('')
    try { await repository.ownerDelete(item.id); setNotice('Termo excluído.'); setAttempt(value => value + 1) }
    catch { setNotice('Não foi possível excluir o termo.') }
    finally { setBusy(false) }
  }
  const normal = (value: string) => value.toLocaleLowerCase('pt-BR').trim()
  const existing = new Map((items ?? []).map(item => [normal(item.term), item]))
  const verify = () => setPreview(parseImport(importText))
  async function readFile(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    setImportText(text); setPreview(parseImport(text)); setNotice('')
  }
  async function runImport() {
    if (!preview || busy) return
    setBusy(true); setNotice('')
    let created = 0, updated = 0, skipped = 0, failed = 0
    for (const row of preview.rows) {
      if (!row.input) continue
      const found = existing.get(normal(row.input.term))
      if (found && !updateExisting) { skipped += 1; continue }
      try {
        await repository.ownerSave({ ...row.input, id: found?.id ?? null, status: found?.status ?? 'draft' })
        if (found) updated += 1; else created += 1
      } catch { failed += 1 }
    }
    setBusy(false); setPreview(null); setImportText(''); setImporting(false); setAttempt(value => value + 1)
    setNotice(`Importação concluída: ${created} novo(s) como rascunho, ${updated} atualizado(s), ${skipped} já existente(s) ignorado(s)${failed ? `, ${failed} com erro ao salvar` : ''}.`)
  }
  async function bulk(status: StudyStatus) {
    if (busy || !items) return
    const targets = items.filter(item => selected.includes(item.id) && item.status !== status)
    setBusy(true); setNotice('')
    let done = 0, failed = 0
    for (const item of targets) {
      try { await repository.ownerSave({ id: item.id, term: item.term, words: item.words, original: item.original, context: item.context, parallel_reference: item.parallel_reference, status, verses: item.verses }); done += 1 } catch { failed += 1 }
    }
    setBusy(false); setSelected([]); setAttempt(value => value + 1)
    setNotice(`${done} termo(s) ${status === 'published' ? 'publicado(s)' : 'voltaram a rascunho'}${failed ? `; ${failed} com erro` : ''}.`)
  }
  const toggleSelected = (id: string) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  const set = (patch: Partial<Draft>) => setEditing(current => current ? { ...current, ...patch } : current)

  return <section className="study-manager" aria-labelledby="study-manager-title">
    <div className="section-heading"><div><div className="eyebrow">RAIO-X DO TEXTO</div><h2 id="study-manager-title">Termos para entender o texto</h2></div>
      <div className="actions"><button type="button" className="button secondary" aria-expanded={importing} onClick={() => { setImporting(value => !value); setPreview(null) }}>Importar em lote</button>
        <button type="button" className="button primary" disabled={busy} onClick={() => { setEditing(blank); setNotice('') }}>+ Novo termo</button></div></div>
    <p className="muted">Cada termo explica, em poucas linhas, o sentido no original, o contexto da época e um versículo paralelo. Ele aparece sublinhado nos versículos ligados a ele e como atalho no capítulo, e só para leitores depois de publicado.</p>
    {error && <div className="info" role="alert">{error} <button type="button" className="button secondary" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></div>}
    {notice && <p className="success" role="status">{notice}</p>}
    {importing && <div className="editor study-import">
      <h3>Importar termos em lote</h3>
      <p className="muted">Envie o arquivo de termos (JSON) ou cole o conteúdo. Nada é enviado antes da conferência, e tudo entra como <strong>rascunho</strong>: você revisa e publica depois.</p>
      <label>Arquivo de termos<input type="file" accept=".json,application/json" onChange={event => void readFile(event.target.files?.[0])} /></label>
      <label>Ou cole aqui<textarea value={importText} onChange={event => { setImportText(event.target.value); setPreview(null) }} placeholder='[{ "term": "Graça", "words": ["graça"], ... }]' /></label>
      <div className="actions"><button type="button" className="button secondary" disabled={!importText.trim()} onClick={verify}>Conferir</button></div>
      {preview?.error && <div className="info" role="alert">{preview.error}</div>}
      {preview && !preview.error && <>
        <p role="status"><strong>{preview.rows.filter(row => row.input).length}</strong> termo(s) válido(s), <strong>{preview.rows.filter(row => !row.input).length}</strong> com problema, <strong>{preview.rows.filter(row => row.input && existing.has(normal(row.input.term))).length}</strong> já existe(m).</p>
        <ul className="study-preview">{preview.rows.map((row, index) => <li key={index} data-ok={row.input ? 'true' : 'false'}><strong>{row.label}</strong>{row.input ? (existing.has(normal(row.input.term)) ? <span>já existe</span> : <span>novo</span>) : <span>{row.problems.join('; ')}</span>}</li>)}</ul>
        <label className="owner-check"><input type="checkbox" checked={updateExisting} onChange={event => setUpdateExisting(event.target.checked)} /> Atualizar os termos que já existem (mantém a situação atual)</label>
        <div className="actions"><button type="button" className="button primary" disabled={busy || !preview.rows.some(row => row.input)} onClick={() => void runImport()}>{busy ? 'Importando…' : `Importar ${preview.rows.filter(row => row.input && (updateExisting || !existing.has(normal(row.input.term)))).length} termo(s) como rascunho`}</button></div>
      </>}
    </div>}
    {editing && <form className="editor study-editor" onSubmit={event => void save(event)} noValidate>
      <h3>{editing.id ? 'Editar termo' : 'Novo termo'}</h3>
      <fieldset disabled={busy}><div className="form-grid">
        <label>Termo (título da gaveta)<input maxLength={60} value={editing.term} onChange={event => set({ term: event.target.value })} /></label>
        <label>Palavras que ficam sublinhadas (separe por vírgula)<input value={editing.words} onChange={event => set({ words: event.target.value })} placeholder="graça, graças" /></label>
        <label className="study-wide">No original<textarea maxLength={300} value={editing.original} onChange={event => set({ original: event.target.value })} /></label>
        <label className="study-wide">Na época (contexto cultural)<textarea maxLength={500} value={editing.context} onChange={event => set({ context: event.target.value })} /></label>
        <label>Versículo paralelo<input maxLength={80} value={editing.parallel_reference} onChange={event => set({ parallel_reference: event.target.value })} placeholder="Romanos 11:6" /></label>
        <label>Situação<select value={editing.status} onChange={event => set({ status: event.target.value as StudyStatus })}><option value="draft">Rascunho</option><option value="published">Publicado</option></select></label>
        <label className="study-wide">Versículos onde vale (um por linha)<textarea value={editing.verses} onChange={event => set({ verses: event.target.value })} placeholder={'Efésios 2:8\nRomanos 3:24'} /></label>
      </div>
      <div className="actions"><button className="button primary" type="submit">{busy ? 'Salvando…' : 'Salvar termo'}</button>
        <button type="button" className="button secondary" onClick={() => void save(null, 'published')}>Salvar e publicar</button>
        <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancelar</button></div></fieldset>
    </form>}
    {!items && !error && <p role="status">Carregando termos…</p>}
    {items && !items.length && <div className="info">Nenhum termo cadastrado.</div>}
    {items && items.length > 0 && <div className="study-bulk" role="group" aria-label="Seleção em lote">
      <label className="owner-check"><input type="checkbox" checked={selected.length === items.length} onChange={event => setSelected(event.target.checked ? items.map(item => item.id) : [])} /> Selecionar todos</label>
      <button type="button" className="button secondary" disabled={busy} onClick={() => setSelected(items.filter(item => item.status === 'draft').map(item => item.id))}>Só rascunhos</button>
      <button type="button" className="button primary" disabled={busy || !selected.length} onClick={() => void bulk('published')}>Publicar selecionados ({selected.length})</button>
      <button type="button" className="button secondary" disabled={busy || !selected.length} onClick={() => void bulk('draft')}>Despublicar selecionados</button>
    </div>}
    {items && <ul className="study-list">{items.map(item => <li key={item.id}>
      <input type="checkbox" className="study-pick" aria-label={`Selecionar ${item.term}`} checked={selected.includes(item.id)} onChange={() => toggleSelected(item.id)} />
      <div><strong>{item.term}</strong><small>{item.verses.length} {item.verses.length === 1 ? 'versículo' : 'versículos'} · {item.words.join(', ')}</small><p>{item.original}</p></div>
      <span className="chip" data-status={item.status}>{item.status === 'published' ? 'Publicado' : 'Rascunho'}</span>
      <button type="button" className="text-link" disabled={busy} onClick={() => { setEditing(toDraft(item)); setNotice('') }}>Editar</button>
      <button type="button" className="text-link" disabled={busy} onClick={() => void toggle(item)}>{item.status === 'published' ? 'Despublicar' : 'Publicar'}</button>
      <button type="button" className="text-link" disabled={busy} onClick={() => void remove(item)}>Excluir</button>
    </li>)}</ul>}
  </section>
}
