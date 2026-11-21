import { useEffect, useRef } from 'react'
import { ShareDevotional } from './ShareDevotional'

// Pop-up central exibido logo após o leitor concluir o devocional, convidando a compartilhar.
// Fecha pelo X, pelo Esc, clicando fora, e sozinho depois que a imagem é enviada ao menu de compartilhamento.
export function ShareCompletionDialog({ id, title, phrase, author, reference, onClose }: { id: string; title?: string; phrase?: string | null; author?: string | null; reference?: string; onClose: () => void }) {
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
      <button ref={closeButton} type="button" className="share-dialog-close" aria-label="Fechar" onClick={onClose}>✕</button>
      <div className="eyebrow">DEVOCIONAL CONCLUÍDO</div>
      <h2 id="share-dialog-title">Que a Palavra continue com você</h2>
      <p className="muted">Quer compartilhar este devocional com alguém que também precisa desta Palavra?</p>
      <ShareDevotional id={id} title={title} phrase={phrase} author={author} reference={reference} onShared={onClose} />
    </div>
  </div>
}
