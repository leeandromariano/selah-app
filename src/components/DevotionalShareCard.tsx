import { useEffect, useRef, useState } from 'react'
import { cardDimensions, drawDevotionalCard } from '../devotionals/shareCard'
import type { CardArt, CardTheme } from '../devotionals/shareCard'
import { parseReference } from '../bible/catalog'

// Compartilhar no tamanho de Story (1080 × 1920), com duas versões para escolher (escuro e claro). No celular abre o menu de compartilhamento; no computador baixa o PNG.
// A imagem não leva o endereço do devocional; o link só segue no texto do compartilhamento.
const versions = [{ theme: 'obsidian', label: 'Modo escuro' }, { theme: 'paper', label: 'Modo claro' }] as const
function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>(resolve => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}
export function DevotionalShareCard({ id, title, phrase, author, reference, link, onShared }: {
  id: string; title: string; phrase?: string | null; author?: string | null; reference: string; link: string; onShared?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [previewReady, setPreviewReady] = useState(false)
  const [theme, setTheme] = useState<CardTheme>('obsidian')
  const [art, setArt] = useState<CardArt | undefined>()
  const previews = useRef<Record<string, HTMLCanvasElement | null>>({})
  const validReference = parseReference(reference)
  const fileName = `coram-devocional-${id}-story-${theme === 'paper' ? 'claro' : 'escuro'}.png`

  // Desenha o card de Story (1080 × 1920) no canvas dado; o mesmo desenho serve à prévia e à imagem compartilhada.
  function draw(canvas: HTMLCanvasElement, version: CardTheme = theme) {
    const dimensions = cardDimensions.story
    canvas.width = dimensions.width; canvas.height = dimensions.height
    const context = canvas.getContext('2d')
    if (!context) return false
    drawDevotionalCard(context, { title, phrase, author, reference, format: 'story', theme: version, art })
    return true
  }

  function renderCard() {
    const canvas = document.createElement('canvas')
    if (!draw(canvas)) throw Error('Canvas unavailable')
    return canvas
  }

  // Prévia: a própria imagem que vai ser compartilhada, visível antes de tocar no botão. Só aparece depois de desenhada.
  useEffect(() => {
    let live = true
    void Promise.all([loadImage('/home/palavra.webp'), loadImage('/home/flame.webp')]).then(([book, flame]) => { if (live && book && flame) setArt({ book, flame }) })
    return () => { live = false }
  }, [])
  useEffect(() => {
    if (!validReference) return
    let live = true
    void (async () => {
      try {
        await document.fonts?.ready
        const drawn = versions.map(version => { const canvas = previews.current[version.theme]; return canvas ? draw(canvas, version.theme) : false })
        if (live) setPreviewReady(drawn.every(Boolean))
      } catch { if (live) setPreviewReady(false) }
    })()
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, phrase, author, reference, link, validReference, art])

  async function saveCanvas(canvas: HTMLCanvasElement) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw Error('PNG unavailable')
    const url = URL.createObjectURL(blob)
    try {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      anchor.click()
      setMessage('O PNG foi baixado porque este navegador não compartilha imagens. No Instagram, toque em + e escolha a imagem baixada.')
    } finally { const revoke = URL.revokeObjectURL.bind(URL); window.setTimeout(() => revoke(url), 1000) }
  }

  async function shareImage() {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      await document.fonts?.ready
      const canvas = renderCard()
      if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') { await saveCanvas(canvas); return }
      // Synchronous PNG creation keeps the browser's user gesture active for Web Share.
      const dataUrl = canvas.toDataURL('image/png')
      if (!dataUrl.startsWith('data:image/png;base64,')) throw Error('PNG unavailable')
      const binary = atob(dataUrl.slice('data:image/png;base64,'.length))
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
      const file = new File([bytes], fileName, { type: 'image/png' })
      if (!navigator.canShare({ files: [file] })) { await saveCanvas(canvas); return }
      await navigator.share({ files: [file], title: `Coram · ${title}`, text: `${phrase?.trim() || title}\n\nLeia no Coram: ${link}` })
      setMessage('Imagem enviada ao menu de compartilhamento.')
      onShared?.()
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === 'AbortError' ? 'Compartilhamento cancelado.' : 'Não foi possível compartilhar a imagem. Tente novamente.')
    } finally { setBusy(false) }
  }

  if (!validReference) return null
  return <div className="devotional-share-card">
    <fieldset className="devotional-share-versions" hidden={!previewReady}><legend>Escolha a versão da imagem</legend>
      <div className="devotional-share-options">{versions.map(version => <label key={version.theme} className={theme === version.theme ? 'selected' : ''}>
        <input type="radio" name={`share-version-${id}`} value={version.theme} checked={theme === version.theme} onChange={() => setTheme(version.theme)} />
        <canvas ref={element => { previews.current[version.theme] = element }} role="img" aria-label={`Prévia da imagem em ${version.label.toLocaleLowerCase('pt-BR')}`} /><span>{version.label}</span>
      </label>)}</div>
      <p className="muted">Esta é a imagem que será compartilhada.</p>
    </fieldset>
    <button type="button" className="button primary" disabled={busy} onClick={() => void shareImage()}>{busy ? 'Preparando imagem…' : 'Compartilhar no Instagram'}</button>
    <p className="muted">Escolha Instagram e depois Stories no menu do celular.</p>
    {message && <p role="status">{message}</p>}
  </div>
}
