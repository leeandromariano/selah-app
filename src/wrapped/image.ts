import type { CardContext } from '../duel/card'
import { artFor, cardText, cardTitle } from './model'
import type { WrappedCard } from './model'

// Cards do Wrapped para os Stories (1080 × 1920), desenhados em canvas: nada depende de serviço externo.
export const wrappedCardSize = { width: 1080, height: 1920 }
export type WrappedContext = CardContext & { drawImage(image: unknown, x: number, y: number, w: number, h: number): void; measureText(text: string): { width: number } }
const sans = "'Plus Jakarta Sans', Inter, system-ui, sans-serif"

function wrap(ctx: WrappedContext, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const attempt = line ? `${line} ${word}` : word
    if (line && ctx.measureText(attempt).width > maxWidth) { lines.push(line); line = word } else line = attempt
  }
  if (line) lines.push(line)
  return lines
}

export function drawWrappedCard(ctx: WrappedContext, card: WrappedCard, label: string, host: string, art?: unknown) {
  const { width, height } = wrappedCardSize
  const bg = ctx.createLinearGradient(0, 0, 0, height)
  bg.addColorStop(0, '#15161a'); bg.addColorStop(1, '#0b0c0e')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)
  const glow = ctx.createRadialGradient(width / 2, 620, 40, width / 2, 620, 760)
  glow.addColorStop(0, 'rgba(255,85,0,0.38)'); glow.addColorStop(1, 'rgba(255,85,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#ff7a33'; ctx.font = `800 40px ${sans}`
  ctx.fillText('RECAP CORAM', width / 2, 190)
  ctx.fillStyle = '#9a968e'; ctx.font = `600 46px ${sans}`
  ctx.fillText(label, width / 2, 256, 940)

  if (art) ctx.drawImage(art, width / 2 - 260, 330, 520, 520)

  const { headline, detail } = cardText(card)
  ctx.fillStyle = '#9a968e'; ctx.font = `700 48px ${sans}`
  ctx.fillText(cardTitle[card.kind], width / 2, 960, 940)
  ctx.fillStyle = card.empty ? '#6d6a63' : '#f4f1ea'
  ctx.font = `800 ${headline.length > 12 ? 96 : headline.length > 7 ? 130 : 190}px ${sans}`
  ctx.fillText(headline, width / 2, 1160, 960)
  ctx.fillStyle = '#d8d4cb'; ctx.font = `600 46px ${sans}`
  wrap(ctx, detail, 900).slice(0, 4).forEach((line, index) => ctx.fillText(line, width / 2, 1260 + index * 64, 940))

  if (card.kind === 'presence' && card.milestone) {
    ctx.fillStyle = '#ff7a33'; ctx.font = `800 52px ${sans}`
    ctx.fillText(card.milestone.name, width / 2, 1500, 900)
  }
  ctx.fillStyle = '#ff7a33'; ctx.font = `700 46px ${sans}`
  ctx.fillText(host, width / 2, 1700, 940)
  ctx.fillStyle = '#6d6a63'; ctx.font = `600 34px ${sans}`
  ctx.fillText('Menos rotina. Mais presença.', width / 2, 1780)
}

function loadArt(name: string): Promise<HTMLImageElement | undefined> {
  return new Promise(resolve => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(undefined) // sem a arte, o card sai igual, só sem o objeto 3D
    image.src = `/home/${name}.webp`
  })
}

export async function renderWrappedCard(card: WrappedCard, label: string, host: string): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = wrappedCardSize.width; canvas.height = wrappedCardSize.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw Error('Seu navegador não consegue gerar a imagem.')
  drawWrappedCard(ctx as unknown as WrappedContext, card, label, host, await loadArt(artFor(card)))
  return new Promise((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(Error('Não foi possível gerar a imagem.'))), 'image/png'))
}
