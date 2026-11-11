import { useEffect, useRef } from 'react'
import { ShareDevotional } from './ShareDevotional'

// Pop-up central exibido logo após o leitor concluir o devocional, convidando a compartilhar.
export function ShareCompletionDialog({ id, title, phrase, reference, onClose }: { id: string; title?: string; phrase?: string | null; reference?: string; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.() }
  }, [onClose])
  return <div className="share-dialog-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
      <div className="eyebrow">DEVOCIONAL CONCLUÍDO</div>
      <h2 id="share-dialog-title">Que a Palavra continue com você</h2>
      <p className="muted">Quer compartilhar este devocional com alguém que também precisa desta Palavra?</p>
      <ShareDevotional id={id} title={title} phrase={phrase} reference={reference} />
      <div className="actions"><button ref={closeButton} type="button" className="button secondary" onClick={onClose}>Agora não</button></div>
    </div>
  </div>
}
