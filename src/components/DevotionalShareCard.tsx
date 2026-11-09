import { useState } from 'react'
import { cardDimensions, drawDevotionalCard } from '../devotionals/shareCard'
import type { CardFormat, CardTheme } from '../devotionals/shareCard'
import { parseReference } from '../bible/catalog'

const themeLabels: Record<CardTheme, string> = { obsidian: 'Obsidian', paper: 'Papel Cru', ember: 'Brasa' }

export function DevotionalShareCard({ id, title, phrase, reference, link }: { id: string; title: string; phrase?: string | null; reference: string; link: string }) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<CardFormat>('post')
  const [theme, setTheme] = useState<CardTheme>('obsidian')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const validReference = parseReference(reference)

  function renderCard() {
    const canvas = document.createElement('canvas')
    const dimensions = cardDimensions[format]
    canvas.width = dimensions.width; canvas.height = dimensions.height
    const context = canvas.getContext('2d')
    if (!context) throw Error('Canvas unavailable')
    drawDevotionalCard(context, { title, phrase, reference, url: link, format, theme })
    return canvas
  }

  async function download() {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      await document.fonts?.ready
      const canvas = renderCard()
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw Error('PNG unavailable')
      const url = URL.createObjectURL(blob)
      try {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `coram-devocional-${id}-${format}.png`
        anchor.click()
        setMessage('Card PNG preparado para salvar.')
      } finally { const revoke = URL.revokeObjectURL.bind(URL); window.setTimeout(() => revoke(url), 1000) }
    } catch { setMessage('Não foi possível gerar o card neste navegador. Tente novamente.') }
    finally { setBusy(false) }
  }

  async function shareImage() {
    if (busy) return
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
      setMessage('Este navegador não compartilha imagens diretamente. Use Baixar PNG.'); return
    }
    setBusy(true); setMessage('')
    try {
      // Synchronous PNG creation keeps the browser's user gesture active for Web Share.
      const dataUrl = renderCard().toDataURL('image/png')
      if (!dataUrl.startsWith('data:image/png;base64,')) throw Error('PNG unavailable')
      const binary = atob(dataUrl.slice('data:image/png;base64,'.length))
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
      const file = new File([bytes], `coram-devocional-${id}-${format}.png`, { type: 'image/png' })
      if (!navigator.canShare({ files: [file] })) {
        setMessage('Este navegador não compartilha imagens diretamente. Use Baixar PNG.'); return
      }
      await navigator.share({ files: [file], title: `Coram · ${title}`, text: `${phrase?.trim() || title}\n${link}` })
      setMessage('Imagem enviada ao menu de compartilhamento.')
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === 'AbortError' ? 'Compartilhamento cancelado.' : 'Não foi possível compartilhar a imagem. Use Baixar PNG.')
    } finally { setBusy(false) }
  }

  if (!validReference) return null
  return <div className="devotional-share-card">
    <button type="button" className="button secondary" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? 'Fechar card' : 'Criar card do devocional'}</button>
    {open && <div className="devotional-share-card-editor"><p>Imagem com a frase central do autor, referência e convite para ler no Coram. Devocionais antigos usam o título até que recebam uma frase central.{['127.0.0.1', 'localhost'].includes(location.hostname) && ' O link local só funciona neste computador.'}</p><div className="devotional-share-card-controls"><label>Formato<select value={format} onChange={event => setFormat(event.target.value as CardFormat)}><option value="post">Post · 1080 × 1350</option><option value="story">Story · 1080 × 1920</option></select></label><label>Tema<select value={theme} onChange={event => setTheme(event.target.value as CardTheme)}>{(Object.keys(themeLabels) as CardTheme[]).map(value => <option key={value} value={value}>{themeLabels[value]}</option>)}</select></label></div>
      <div className={`devotional-share-card-preview ${theme} ${format}`} role="img" aria-label={`Prévia do card ${themeLabels[theme]} para ${format === 'post' ? 'post' : 'story'}`}><span className="card-preview-kicker">CORAM / FRASE DO DEVOCIONAL</span><span className="card-preview-reference">{reference}</span><strong>{phrase?.trim() || title}</strong>{phrase?.trim() && phrase.trim() !== title.trim() && <span className="card-preview-title">{title}</span>}<span className="card-preview-bottom">MENOS ROTINA.<em>mais presença.</em><small>C · CORAM · {link}</small></span></div>
      <div className="actions"><button type="button" className="button primary" disabled={busy} onClick={() => void shareImage()}>{busy ? 'Preparando imagem…' : 'Compartilhar imagem'}</button><button type="button" className="button secondary" disabled={busy} onClick={() => void download()}>{busy ? 'Preparando imagem…' : 'Baixar PNG'}</button></div>{message && <p role="status">{message}</p>}
    </div>}
  </div>
}
