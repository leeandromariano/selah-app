import { useState } from 'react'
import { buildShareCaption, cardDimensions, drawDevotionalCard } from '../devotionals/shareCard'
import type { CardFormat, CardTheme } from '../devotionals/shareCard'
import { parseReference } from '../bible/catalog'

const themeLabels: Record<CardTheme, string> = { obsidian: 'Obsidian', paper: 'Papel Cru', ember: 'Brasa' }
const formatLabels: Record<CardFormat, { name: string; short: string; size: string }> = {
  story: { name: 'Story', short: 'story', size: '1080 × 1920' },
  post: { name: 'Feed', short: 'feed', size: '1080 × 1350' },
}

export function DevotionalShareCard({ id, title, phrase, author, reference, link }: { id: string; title: string; phrase?: string | null; author?: string | null; reference: string; link: string }) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<CardTheme>('obsidian')
  const [format, setFormat] = useState<CardFormat>('story')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const validReference = parseReference(reference)
  const fileName = `coram-devocional-${id}-${formatLabels[format].short}.png`

  function renderCard() {
    const canvas = document.createElement('canvas')
    const dimensions = cardDimensions[format]
    canvas.width = dimensions.width; canvas.height = dimensions.height
    const context = canvas.getContext('2d')
    if (!context) throw Error('Canvas unavailable')
    drawDevotionalCard(context, { title, phrase, author, reference, url: link, format, theme })
    return canvas
  }

  async function saveCanvas(canvas: HTMLCanvasElement, fallback: boolean) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw Error('PNG unavailable')
    const url = URL.createObjectURL(blob)
    try {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      anchor.click()
      setMessage(fallback ? 'O PNG foi baixado porque este navegador não compartilha imagens. No Instagram, toque em + e escolha a imagem baixada; use "Copiar legenda" para colar o texto.' : 'Card PNG preparado para salvar.')
    } finally { const revoke = URL.revokeObjectURL.bind(URL); window.setTimeout(() => revoke(url), 1000) }
  }

  async function download() {
    if (busy) return
    setBusy(true); setMessage('')
    try { await document.fonts?.ready; await saveCanvas(renderCard(), false) }
    catch { setMessage('Não foi possível gerar o card neste navegador. Tente novamente.') }
    finally { setBusy(false) }
  }

  async function shareImage() {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      const canvas = renderCard()
      if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') { await saveCanvas(canvas, true); return }
      // Synchronous PNG creation keeps the browser's user gesture active for Web Share.
      const dataUrl = canvas.toDataURL('image/png')
      if (!dataUrl.startsWith('data:image/png;base64,')) throw Error('PNG unavailable')
      const binary = atob(dataUrl.slice('data:image/png;base64,'.length))
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
      const file = new File([bytes], fileName, { type: 'image/png' })
      if (!navigator.canShare({ files: [file] })) { await saveCanvas(canvas, true); return }
      await navigator.share({ files: [file], title: `Coram · ${title}`, text: `${phrase?.trim() || title}\n\nLeia no Coram: ${link}` })
      setMessage('Imagem enviada ao menu de compartilhamento.')
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === 'AbortError' ? 'Compartilhamento cancelado.' : 'Não foi possível compartilhar a imagem. Tente baixar o PNG.')
    } finally { setBusy(false) }
  }

  async function copyCaption() {
    try { await navigator.clipboard.writeText(buildShareCaption({ title, phrase, author, reference, link })); setMessage('Legenda copiada. Cole na legenda do Instagram.') }
    catch { setMessage('Não foi possível copiar a legenda neste navegador.') }
  }

  if (!validReference) return null
  return <div className="devotional-share-card">
    <div className="devotional-share-card-format" role="group" aria-label="Formato da imagem">
      {(Object.keys(formatLabels) as CardFormat[]).map(value => <button key={value} type="button" className="button secondary" aria-pressed={format === value} onClick={() => setFormat(value)}>{formatLabels[value].name}</button>)}
    </div>
    <button type="button" className="button primary" disabled={busy} onClick={() => void shareImage()}>{busy ? 'Preparando imagem…' : 'Compartilhar no Instagram'}</button>
    <button type="button" className="button secondary" onClick={() => void copyCaption()}>Copiar legenda</button>
    <button type="button" className="button secondary" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? 'Fechar prévia' : 'Prévia e download'}</button>
    <p className="muted">Abre o menu do seu celular: escolha Instagram e depois Stories ou Feed. No Story, use o adesivo Link para colocar o endereço.</p>
    {open && <div className="devotional-share-card-editor"><p>Imagem de {formatLabels[format].size} com frase central, autor, referência e link visível. O link também acompanha a imagem no texto do compartilhamento. Devocionais antigos usam o título até que recebam uma frase central.{['127.0.0.1', 'localhost'].includes(location.hostname) && ' O link local só funciona neste computador.'}</p><div className="devotional-share-card-controls"><label>Tema<select value={theme} onChange={event => setTheme(event.target.value as CardTheme)}>{(Object.keys(themeLabels) as CardTheme[]).map(value => <option key={value} value={value}>{themeLabels[value]}</option>)}</select></label></div>
      <div className={`devotional-share-card-preview ${theme} ${format === 'story' ? 'story' : 'feed'}`} role="img" aria-label={`Prévia do card ${themeLabels[theme]} para ${formatLabels[format].short}`}><span className="card-preview-kicker">CORAM / FRASE DO DEVOCIONAL</span><span className="card-preview-reference">{reference}</span><strong>{phrase?.trim() || title}</strong>{author?.trim() && <span className="card-preview-author">{author.trim()}</span>}{phrase?.trim() && phrase.trim() !== title.trim() && <span className="card-preview-title">{title}</span>}<span className="card-preview-bottom">MENOS ROTINA.<em>mais presença.</em><small>CORAM · {link}</small></span></div>
      <button type="button" className="button secondary" disabled={busy} onClick={() => void download()}>{busy ? 'Preparando imagem…' : 'Baixar PNG'}</button>
    </div>}{message && <p role="status">{message}</p>}
  </div>
}
