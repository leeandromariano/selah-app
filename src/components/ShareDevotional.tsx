import { useState } from 'react'
import { devotionalShareLink } from '../notifications/sharing'
import { DevotionalShareCard } from './DevotionalShareCard'
// Rendered only for a publication returned by the existing authorized repository.
export function ShareDevotional({ id, title, phrase, reference }: { id: string; title?: string; phrase?: string | null; reference?: string }) {
  const [message, setMessage] = useState('')
  const link = devotionalShareLink(id, location.origin)
  if (!link) return null
  const text = `${phrase?.trim() || title?.trim() || 'Uma pausa com a Palavra no Coram.'} Leia o devocional no Coram. O link exige uma conta.`
  async function copy() {
    try { await navigator.clipboard.writeText(link!); setMessage('Link copiado.') }
    catch { setMessage('Selecione e copie o endereço abaixo.') }
  }
  return <section className="reflection" aria-label="Compartilhar devocional"><h2>Compartilhar este devocional</h2>
    <div className="actions">
      <button className="button" onClick={async () => {
        if (typeof navigator.share !== 'function') { await copy(); return }
        try { await navigator.share({ title: 'Coram', text, url: link }); setMessage('Compartilhamento aberto por sua escolha.') }
        catch { setMessage('Compartilhamento cancelado ou indisponível. Você pode copiar o link.') }
      }}>Compartilhar</button>
      {typeof navigator.share !== 'function' && <p>O compartilhamento nativo não está disponível. O botão Compartilhar copia o link.</p>}
      <button className="button secondary" onClick={() => void copy()}>Copiar link</button>
      <a className="button secondary" href={'https://wa.me/?text=' + encodeURIComponent(text + ' ' + link)} target="_blank" rel="noopener noreferrer">Abrir WhatsApp para compartilhar</a>
    </div>{title && reference && <DevotionalShareCard id={id} title={title} phrase={phrase} reference={reference} link={link} />}<label>Link do devocional <input readOnly value={link} onFocus={event => event.target.select()} /></label>
    {message && <p role="status">{message}</p>}
  </section>
}
