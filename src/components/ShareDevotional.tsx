import { useState } from 'react'
import { devotionalShareLink } from '../notifications/sharing'
// Rendered only for a publication returned by the existing authorized repository.
export function ShareDevotional({ id }: { id: string }) {
  const [message, setMessage] = useState('')
  const link = devotionalShareLink(id, location.origin)
  if (!link) return null
  const text = 'Convite para uma pausa com a Palavra no Selah. O link exige uma conta.'
  async function copy() {
    try { await navigator.clipboard.writeText(link!); setMessage('Link copiado.') }
    catch { setMessage('Selecione e copie o endereço abaixo.') }
  }
  return <section className="reflection" aria-label="Compartilhar devocional"><h2>Compartilhar este devocional</h2>
    <p>Convide um amigo, se desejar. Você pode compartilhar antes ou depois de concluir sua leitura.</p>
    <p>O link exige autenticação no Selah. Quem ainda não tem conta precisará se cadastrar. Seu histórico de leitura não é compartilhado.</p>
    {['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && <p>Este endereço local funciona apenas neste ambiente; não é um link público disponível para amigos pela internet.</p>}
    <div className="actions">
      <button className="button" onClick={async () => {
        if (typeof navigator.share !== 'function') { await copy(); return }
        try { await navigator.share({ title: 'Selah', text, url: link }); setMessage('Compartilhamento aberto por sua escolha.') }
        catch { setMessage('Compartilhamento cancelado ou indisponível. Você pode copiar o link.') }
      }}>Compartilhar</button>
      {typeof navigator.share !== 'function' && <p>O compartilhamento nativo não está disponível. O botão Compartilhar copia o link.</p>}
      <button className="button secondary" onClick={() => void copy()}>Copiar link</button>
      <a className="button secondary" href={'https://wa.me/?text=' + encodeURIComponent(text + ' ' + link)} target="_blank" rel="noopener noreferrer">Abrir WhatsApp para compartilhar</a>
    </div><label>Link do devocional <input readOnly value={link} onFocus={event => event.target.select()} /></label>
    {message && <p role="status">{message}</p>}
  </section>
}
