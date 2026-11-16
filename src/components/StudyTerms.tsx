import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { StudyTerm } from '../study/repository'
import { splitByTerms, termsForVerse } from '../study/mark'
import { BibleReference } from './BibleReference'
import { useViewport } from './navigation'
import '../study.css'

// Texto do versículo com os termos sublinhados. O toque abre a gaveta; os chips do capítulo são a via por teclado e leitor de tela.
export function TermText({ text, terms, number, endNumber, onOpen }: { text: string; terms: StudyTerm[]; number: number; endNumber?: number; onOpen: (term: StudyTerm) => void }) {
  const pieces = splitByTerms(text, termsForVerse(terms, number, endNumber))
  if (pieces.length === 1 && !pieces[0].term) return <>{text}</>
  return <>{pieces.map((piece, index) => piece.term
    ? <span key={index} className="study-term" role="button" tabIndex={0} aria-label={`Raio-X: ${piece.term.term}`}
      onClick={(event: MouseEvent) => { event.stopPropagation(); onOpen(piece.term!) }}
      onKeyDown={(event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onOpen(piece.term!) } }}>{piece.text}</span>
    : <span key={index}>{piece.text}</span>)}</>
}

export function StudyChips({ terms, onOpen }: { terms: StudyTerm[]; onOpen: (term: StudyTerm) => void }) {
  if (!terms.length) return null
  return <div className="study-chips" role="group" aria-label="Raio-X do texto neste capítulo">
    <span className="study-chips-label">Raio-X neste capítulo</span>
    {terms.map(term => <button key={term.id} type="button" className="study-chip" onClick={() => onOpen(term)}>{term.term}</button>)}
  </div>
}

// No celular: gaveta inferior em vidro fosco. No computador: aba lateral à direita que não cobre o texto, para continuar lendo.
// Mostra o sentido no original, o contexto da época e um versículo paralelo.
export function StudySheet({ term, onClose }: { term: StudyTerm; onClose: () => void }) {
  const titleId = useId()
  const close = useRef<HTMLButtonElement>(null)
  const docked = useViewport() === 'desktop'
  useEffect(() => {
    if (!docked) return
    document.body.classList.add('study-docked')
    return () => document.body.classList.remove('study-docked')
  }, [docked])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    close.current?.focus()
    const key = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); previous?.focus?.() }
  }, [onClose])
  return createPortal(<>
    {!docked && <div className="study-backdrop" onClick={onClose} />}
    <section className="study-sheet" data-docked={docked ? 'true' : undefined} role="dialog" aria-modal={docked ? 'false' : 'true'} aria-labelledby={titleId}>
      {!docked && <span className="study-grip" aria-hidden="true" />}
      <div className="study-head"><div><div className="eyebrow">RAIO-X DO TEXTO</div><h2 id={titleId}>{term.term}</h2></div>
        <button ref={close} type="button" className="study-close" aria-label="Fechar Raio-X" onClick={onClose}>×</button></div>
      <dl>
        <div><dt>No original</dt><dd>{term.original}</dd></div>
        <div><dt>Na época</dt><dd>{term.context}</dd></div>
        {term.dictionary && <div className="study-dictionary"><dt>Dicionário de teologia</dt>{term.dictionary.split(/\n{2,}/).map((part, index) => <dd key={index}>{part}</dd>)}</div>}
        <div><dt>Versículo paralelo</dt><dd onClick={onClose}><BibleReference reference={term.parallel_reference} /></dd></div>
      </dl>
    </section>
  </>, document.body)
}
